import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { InvestimentoInsert, TipoLiquidez, Categoria } from "@/types/database";

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

function validarEConverter(item: unknown): InvestimentoInsert | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  const nome = typeof obj.nome === "string" ? obj.nome.trim() : "";
  const valor = parseValor(obj.valor_aplicado ?? obj.valor_investido);
  const dataAplic = obj.data_aplicacao;
  const dataVenc = obj.data_vencimento;
  const tipo = obj.tipo_liquidez;
  const categoria = obj.categoria;
  const cnpj = obj.cnpj_fundo;

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

  return {
    nome: nome.slice(0, 200),
    valor_aplicado: valor,
    cnpj_fundo: cnpjStr,
    data_aplicacao: dataAplicStr,
    data_vencimento: dataVencStr,
    tipo_liquidez: tipoLiquidez,
    categoria: categoriaValida,
  };
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
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

TABELAS DE RESUMO (dados parciais):
- Trate cada LINHA da tabela como um investimento individual. Uma linha = um objeto no array.
- Mapeie o campo "valor investido (R$)" ou "valor investido" para valor_aplicado.
- Flexibilidade de datas: se data_aplicacao não estiver visível na tabela, retorne null para esse campo (não ignore o registro).
- Data de vencimento: extraia a data que aparecer no final do nome do produto (ex: "CDB C6 26/06/2028" → data_vencimento "2028-06-26"). Se estiver em DD/MM/AAAA no nome, converta para AAAA-MM-DD no JSON.
- Retorne SEMPRE um array de objetos, mesmo que encontre apenas uma linha válida.`;

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
    "categoria": "Flipping" ou "Reserva" ou "Longo Prazo"
  }
]

Regras:`;

const SYSTEM_PROMPT_RULES = `
- Cada linha de uma tabela de resumo = um investimento. Retorne um objeto por linha.
- Se houver MÚLTIPLOS investimentos (tabela, lista), retorne um array com um objeto para cada um.
- Se houver APENAS UM investimento/linha válida, retorne array com um único objeto: [ { "nome": "...", ... } ]. Nunca retorne um objeto sozinho, sempre um array.
- valor_aplicado: use o valor de "valor investido (R$)" quando a tabela tiver essa coluna. Número com ponto para decimais (ex: 50000.00).
- data_aplicacao: se não estiver na tabela/imagem, retorne null (mantenha o registro).
- data_vencimento: extraia do final do nome do produto quando no formato DD/MM/AAAA (ex: CDB C6 26/06/2028 → "2028-06-26").
- categoria: infira com base no nome do ativo ou data de vencimento.
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

  const model = process.env.OPENAI_MODEL ?? "gpt-4o"; // gpt-4o-mini também suporta visão

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

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Falha ao parsear JSON da LLM:", parseErr);
      return NextResponse.json(
        { error: "Falha ao processar estrutura da tabela" },
        { status: 500 }
      );
    }

    const arr =
      Array.isArray(parsed)
        ? parsed
        : (parsed as Record<string, unknown>).investimentos ??
          (parsed as Record<string, unknown>).data ??
          [];
    const items = Array.isArray(arr) ? arr : [];

    const resultados: InvestimentoInsert[] = [];
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
