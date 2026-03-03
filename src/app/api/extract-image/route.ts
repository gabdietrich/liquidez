import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { InvestimentoInsert, TipoLiquidez, Categoria } from "@/types/database";

export const maxDuration = 60;

export type InvestimentoExtraido = InvestimentoInsert & {
  indexador?: string | null;
  taxa_contratada?: number | null;
};

async function pdfToImages(pdfBase64: string): Promise<Array<{ base64: string; mimeType: string }>> {
  const { pdf } = await import("pdf-to-img");
  const dataUrl = pdfBase64.startsWith("data:")
    ? pdfBase64
    : `data:application/pdf;base64,${pdfBase64}`;
  const doc = await pdf(dataUrl, { scale: 2 });
  const images: Array<{ base64: string; mimeType: string }> = [];
  for await (const pageBuffer of doc) {
    images.push({
      base64: pageBuffer.toString("base64"),
      mimeType: "image/png",
    });
  }
  return images;
}

const VALID_TIPOS: TipoLiquidez[] = ["D+0", "D+30", "No Vencimento"];
const VALID_CATEGORIAS: Categoria[] = ["Reserva", "Longo Prazo", "Flipping"];

function parseValor(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const limpo = val.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(limpo);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseTaxaContratada(val: unknown): number | null {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const limpo = val.replace(/%/g, "").replace(",", ".").trim();
    const n = parseFloat(limpo);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function validarEConverter(item: unknown): InvestimentoExtraido | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  const nome = typeof obj.nome === "string" ? obj.nome.trim() : "";
  const valor = parseValor(obj.valor_aplicado ?? obj.valor_investido);
  const dataAplic = obj.data_aplicacao;
  const dataVenc = obj.data_vencimento;
  const tipo = obj.tipo_liquidez;
  const categoria = obj.categoria;
  const cnpj = obj.cnpj_fundo;
  const indexadorRaw = obj.indexador;
  const taxaRaw = obj.taxa_contratada;
  const quantidadeRaw = obj.quantidade;

  if (!nome || !(valor > 0)) return null;

  let dataAplicStr = formatarDataParaISO(dataAplic);
  let dataVencStr = formatarDataParaISO(dataVenc);
  if (!dataVencStr) dataVencStr = dataAplicStr ?? hojeISO();
  if (!dataAplicStr) dataAplicStr = dataVencStr ?? hojeISO();
  if (!dataAplicStr || !dataVencStr) return null;

  const tipoLiquidez = VALID_TIPOS.includes(tipo as TipoLiquidez)
    ? (tipo as TipoLiquidez)
    : "No Vencimento";
  const categoriaValida = VALID_CATEGORIAS.includes(categoria as Categoria)
    ? (categoria as Categoria)
    : "Reserva";

  const cnpjStr =
    typeof cnpj === "string" && cnpj.trim() ? cnpj.trim() : null;

  const indexador =
    typeof indexadorRaw === "string" && ["CDI", "IPCA", "PRE"].includes(indexadorRaw.trim().toUpperCase())
      ? indexadorRaw.trim().toUpperCase()
      : null;
  const taxa_contratada = parseTaxaContratada(taxaRaw);
  const quantidade =
    typeof quantidadeRaw === "number" && Number.isInteger(quantidadeRaw) && quantidadeRaw > 0
      ? quantidadeRaw
      : typeof quantidadeRaw === "string"
        ? (() => { const n = parseInt(quantidadeRaw, 10); return Number.isNaN(n) || n <= 0 ? null : n; })()
        : null;

  return {
    nome: nome.slice(0, 200),
    valor_aplicado: valor,
    cnpj_fundo: cnpjStr,
    data_aplicacao: dataAplicStr,
    data_vencimento: dataVencStr,
    tipo_liquidez: tipoLiquidez,
    categoria: categoriaValida,
    ...(indexador != null && { indexador }),
    ...(taxa_contratada != null && { taxa_contratada }),
    ...(quantidade != null && { quantidade }),
  };
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Limpeza rigorosa do retorno da IA para garantir JSON.parse mesmo com markdown (```json) ou texto extra. */
function cleanJsonResponse(content: string): string {
  if (!content || typeof content !== "string") return "[]";
  let s = content.trim();
  // Remove BOM e caracteres de controle no início
  s = s.replace(/^\uFEFF/, "").replace(/^[\x00-\x1F]+/, "");
  // Extrai bloco entre ```json e ``` ou entre ``` e ```
  const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    s = codeBlockMatch[1].trim();
  } else {
    // Sem blocos: remove apenas prefixos/sufixos soltos de ```
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  return s || "[]";
}

function formatarDataParaISO(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const match = val.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, dia, mes, ano] = match;
      return `${ano}-${mes}-${dia}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  }
  return null;
}

const SYSTEM_PROMPT_BASE = `Você é um especialista financeiro. Serão fornecidas uma ou mais imagens de extratos de investimento.

CONSOLIDE as informações de TODAS as imagens enviadas em um único array de investimentos. Se o mesmo investimento (mesmo ativo/nome) aparecer em mais de uma imagem, combine os dados em um único objeto, priorizando os valores mais completos.`;

const SYSTEM_PROMPT_TABELAS_RESUMO = `

TABELAS E PRINTS DE TABELA (analise linha por linha):
- Você deve extrair investimentos de tabelas mesmo que dados como "data de aplicação" estejam ausentes. Foque em: Nome do Produto (extraia taxa e vencimento do texto quando possível) e Valor Investido (R$). Se a data de aplicação não estiver visível, retorne null para data_aplicacao (não omita o registro).
- Analise a imagem LINHA POR LINHA. Mesmo que faltem colunas, extraia tudo o que estiver disponível.
- "Valor investido (R$)" ou "valor investido" e nome do produto são suficientes para criar um registro.
- Se encontrar "CDB C6", "CDB FIBRA", "CDB LUSOBRASILEI" ou similares, trate CADA UM como um objeto separado (uma linha = um objeto).
- NÃO retorne erro se a imagem for uma tabela parcial. Extraia o máximo de linhas possível.
- Mapeie "valor investido (R$)" para valor_aplicado. Data de vencimento: extraia do nome quando no formato DD/MM/AAAA e converta para AAAA-MM-DD. Se data_aplicacao for nula, retorne null.
- Retorne SEMPRE um array de objetos, mesmo que seja apenas uma linha válida.`;

const SYSTEM_PROMPT_INDEXADOR_TAXA = `

INDEXADOR E TAXA (extrair do nome do produto quando não houver campos explícitos):
- Se o nome contiver "CDI", "IPCA" ou "PRE", identifique como o indexador (retorne "CDI", "IPCA" ou "PRE" no campo indexador).
- Extraia o valor numérico da taxa associada (ex: "125.5%" no Agibank, "15.34%" no C6) para o campo taxa_contratada (apenas o número, ex: 125.5 ou 15.34).
- Exemplo: "CDB FIBRA IPCA 9.1%" → indexador "IPCA", taxa_contratada 9.1.
- Exemplo: "CDB Agibank CDI 125.5%" → indexador "CDI", taxa_contratada 125.5.
- Se não identificar indexador ou taxa no nome, retorne null para esses campos.
- Quantidade: quando a tabela ou o print tiver número de cotas/unidades (ex: 25 no Agibank, 70 no CDB PRE), extraia para o campo quantidade (número inteiro). Retorne null se não houver.`;

const SYSTEM_PROMPT_PDF_CONTEXT = `

CONTEXTO PARA PDF: As imagens enviadas representam páginas sequenciais de um único documento financeiro. Analise TODAS elas para identificar e extrair TODOS os ativos mencionados. Se um ativo começar em uma página e terminar em outra, consolide as informações em um único objeto.`;

const SYSTEM_PROMPT_FORMAT = `

Formato OBRIGATÓRIO: retorne SEMPRE um array JSON. Exemplo:
[
  {
    "nome": "Nome do ativo",
    "valor_aplicado": 0.00,
    "data_aplicacao": "AAAA-MM-DD" ou null,
    "data_vencimento": "AAAA-MM-DD",
    "tipo_liquidez": "No Vencimento" ou "D+0" ou "D+30",
    "categoria": "Flipping" ou "Reserva" ou "Longo Prazo",
    "indexador": "CDI" ou "IPCA" ou "PRE" ou null,
    "taxa_contratada": 0.00 ou null,
    "quantidade": número inteiro ou null
  }
]

Regras:`;

const SYSTEM_PROMPT_RULES = `
- Cada linha de uma tabela = um investimento. CDB C6, CDB FIBRA, CDB LUSOBRASILEI etc. = cada um um objeto separado no array.
- Tabela parcial ou com colunas faltando: NÃO falhe. Extraia o máximo de linhas possível usando "valor investido (R$)" e nome do produto.
- Se houver MÚLTIPLOS investimentos (tabela, lista), retorne um array com um objeto para cada linha.
- Se houver APENAS UM investimento/linha válida, retorne array com um único objeto: [ { "nome": "...", ... } ]. Sempre array, nunca objeto sozinho.
- valor_aplicado: use "valor investido (R$)" quando existir. Número com ponto para decimais (ex: 50000.00).
- data_aplicacao: se não estiver na tabela/imagem, retorne null (mantenha o registro).
- data_vencimento: extraia do final do nome do produto quando no formato DD/MM/AAAA (ex: CDB C6 26/06/2028 → "2028-06-26").
- categoria: infira com base no nome do ativo ou data de vencimento.
- indexador: do nome do produto, identifique CDI, IPCA ou PRE quando presente. Retorne null se não houver.
- taxa_contratada: extraia o número da taxa em % do nome (ex: "9.1%" → 9.1, "125.5%" → 125.5). Apenas o número. Retorne null se não houver.
- quantidade: número de cotas/unidades quando aparecer na tabela (ex: 25, 70). Retorne null se não houver.
- Para campos não encontrados, retorne null. Não invente dados.
- Se não houver investimentos em nenhuma imagem, retorne [].`;

const MAX_PAGES_WARNING = 10;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada" },
      { status: 500 }
    );
  }

  let images: Array<{ base64: string; mimeType: string }> = [];
  let isFromPdf = false;
  let aviso: string | undefined;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Erro ao parsear JSON:", msg);
    const isSizeError = /body|size|limit|exceeded/i.test(msg);
    return NextResponse.json(
      {
        error: isSizeError
          ? "Arquivo muito grande. Tente um PDF ou imagem menor (máx. ~7MB)."
          : "Corpo da requisição inválido.",
      },
      { status: 400 }
    );
  }

  try {
    if (typeof body.pdf === "string" && body.pdf.length > 0) {
      isFromPdf = true;
      const pdfBase64 = body.pdf.replace(/^data:application\/pdf;base64,/, "");
      if (!pdfBase64 || pdfBase64.length < 100) {
        return NextResponse.json(
          { error: "PDF inválido ou corrompido." },
          { status: 400 }
        );
      }
      const pdfImages = await pdfToImages(pdfBase64);
      images.push(...pdfImages);
      if (pdfImages.length > MAX_PAGES_WARNING) {
        aviso = `PDF com ${pdfImages.length} páginas. O processamento pode demorar um pouco mais.`;
      }
    }

    if (Array.isArray(body.images)) {
      const extra = body.images.filter(
        (img: unknown) =>
          img &&
          typeof img === "object" &&
          typeof (img as Record<string, unknown>).base64 === "string"
      ).map((img: Record<string, unknown>) => ({
        base64: String(img.base64),
        mimeType: typeof img.mimeType === "string" ? img.mimeType : "image/jpeg",
      }));
      images = images.concat(extra);
    } else if (typeof body.image === "string" && images.length === 0) {
      images = [{
        base64: body.image,
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "image/jpeg",
      }];
    }
  } catch (e) {
    console.error("Erro ao processar PDF/imagens:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: /pdf|invalid|corrupt/i.test(msg)
          ? "PDF inválido ou não suportado. Tente outro arquivo."
          : "Erro ao processar PDF. Tente uma imagem (PNG/JPG) em vez disso.",
      },
      { status: 400 }
    );
  }

  if (images.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma imagem ou PDF fornecido" },
      { status: 400 }
    );
  }

  const model = "gpt-4o-mini";

  const userContent: Array<{ type: "image_url"; image_url: { url: string } }> =
    images.map((img) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    }));

  const systemPrompt =
    SYSTEM_PROMPT_BASE +
    SYSTEM_PROMPT_TABELAS_RESUMO +
    SYSTEM_PROMPT_INDEXADOR_TAXA +
    (isFromPdf ? SYSTEM_PROMPT_PDF_CONTEXT : "") +
    SYSTEM_PROMPT_FORMAT +
    SYSTEM_PROMPT_RULES;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
        ...userContent,
        { type: "text", text: "Extraia os dados das imagens acima e retorne em formato json como array: [ { \"nome\": \"...\", ... } ]. Se houver múltiplos investimentos (tabela/lista), retorne um objeto para cada. Se houver apenas um, retorne array com um único objeto." },
      ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Resposta vazia do modelo" },
        { status: 500 }
      );
    }

    console.log("LLM Raw Response:", content);

    const jsonStr = cleanJsonResponse(content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      // Última tentativa: extrair objeto/array entre primeiro [ e último ] ou { e }
      const firstBracket = jsonStr.indexOf("[");
      const lastBracket = jsonStr.lastIndexOf("]");
      const firstBrace = jsonStr.indexOf("{");
      const lastBrace = jsonStr.lastIndexOf("}");
      const tryArray =
        firstBracket !== -1 && lastBracket > firstBracket
          ? jsonStr.slice(firstBracket, lastBracket + 1)
          : null;
      const tryObj =
        firstBrace !== -1 && lastBrace > firstBrace
          ? jsonStr.slice(firstBrace, lastBrace + 1)
          : null;
      try {
        if (tryArray) parsed = JSON.parse(tryArray);
        else if (tryObj) parsed = JSON.parse(tryObj);
        else throw parseErr;
      } catch (fallbackErr) {
        console.error("Falha ao parsear JSON da LLM:", parseErr, "Fallback:", fallbackErr);
        return NextResponse.json(
          { error: "Falha ao processar estrutura da tabela" },
          { status: 500 }
        );
      }
    }

    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>).investimentos ??
        (parsed as Record<string, unknown>).data ??
        (parsed !== null &&
        typeof parsed === "object" &&
        "nome" in (parsed as Record<string, unknown>)
          ? [parsed]
          : []);
    const items = Array.isArray(arr) ? arr : [];

    const resultados: InvestimentoExtraido[] = [];
    for (const item of items) {
      const validado = validarEConverter(item);
      if (validado) resultados.push(validado);
    }

    return NextResponse.json(
      aviso ? { dados: resultados, aviso } : { dados: resultados }
    );
  } catch (err) {
    console.error("Erro ao extrair imagem:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao processar imagem" },
      { status: 500 }
    );
  }
}
