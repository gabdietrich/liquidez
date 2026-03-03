import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { TipoLiquidez, Categoria } from "@/types/database";

export const maxDuration = 60;

export type InvestimentoExtraido = {
  nome: string;
  valor_aplicado: number;
  cnpj_fundo: string | null;
  data_aplicacao: string | null;
  data_vencimento: string | null;
  tipo_liquidez: TipoLiquidez;
  categoria: Categoria;
  indexador?: string | null;
  taxa_contratada?: number | null;
  quantidade?: number | null;
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

  const dataAplicStr = formatarDataParaISO(dataAplic);
  const dataVencStr =
    formatarDataParaISO(dataVenc) ?? extrairDataDoNome(nome) ?? null;

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
    indexador,
    taxa_contratada,
    quantidade,
  };
}

function extrairDataDoNome(nome: string): string | null {
  const m = nome.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return `${ano}-${mes}-${dia}`;
}

/** Limpeza rigorosa do retorno da IA para garantir JSON.parse mesmo com markdown (```json) ou texto extra. */
function cleanJsonResponse(content: string): string {
  if (!content || typeof content !== "string") return "[]";
  let s = content.trim();
  // Remove BOM e caracteres de controle no início
  s = s.replace(/^\uFEFF/, "").replace(/^[\x00-\x1F]+/, "");
  // Remove marcação markdown comum
  s = s.replace(/^json\s*/i, "").trim();
  // Extrai bloco entre ```json e ``` ou entre ``` e ```
  const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    s = codeBlockMatch[1].trim();
  } else {
    // Sem blocos: remove apenas prefixos/sufixos soltos de ```
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  // Remove comentários JS que quebram JSON.parse
  s = s.replace(/^\s*\/\/.*$/gm, "").trim();
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

const SYSTEM_PROMPT = `Você deve extrair investimentos de tabelas mesmo que dados como "data de aplicação" estejam ausentes.

Foque em:
- Nome do Produto (extraia taxa e vencimento do texto se possível)
- Valor Investido (R$)

Se a data de aplicação for ausente, retorne null em data_aplicacao.
Não invente dados.

Retorne SEMPRE JSON no formato:
{
  "investimentos": [
    {
      "nome": "Nome do ativo",
      "valor_aplicado": 0.00,
      "data_aplicacao": "AAAA-MM-DD" ou null,
      "data_vencimento": "AAAA-MM-DD" ou null,
      "tipo_liquidez": "No Vencimento" ou "D+0" ou "D+30",
      "categoria": "Flipping" ou "Reserva" ou "Longo Prazo",
      "cnpj_fundo": "XX.XXX.XXX/XXXX-XX" ou null,
      "indexador": "CDI" ou "IPCA" ou "PRE" ou null,
      "taxa_contratada": número ou null,
      "quantidade": número inteiro ou null
    }
  ]
}

Regras adicionais:
- Analise imagens de tabelas linha por linha.
- Cada linha válida da tabela deve virar um item em investimentos.
- Mapeie "Valor Investido (R$)" para valor_aplicado.
- Se houver data no nome do produto (DD/MM/AAAA), use como data_vencimento.
- Se não houver investimentos, retorne {"investimentos": []}.`;

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

  const systemPrompt = isFromPdf
    ? `${SYSTEM_PROMPT}\n\nAs imagens podem ser páginas de um mesmo PDF. Consolide o resultado no mesmo array.`
    : SYSTEM_PROMPT;

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
