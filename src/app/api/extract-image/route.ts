import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { InvestimentoInsert, TipoLiquidez, Categoria } from "@/types/database";

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
  const valor = parseValor(obj.valor_aplicado);
  const dataAplic = obj.data_aplicacao;
  const dataVenc = obj.data_vencimento;
  const tipo = obj.tipo_liquidez;
  const categoria = obj.categoria;
  const cnpj = obj.cnpj_fundo;

  if (!nome || !(valor > 0)) return null;

  const dataAplicStr = formatarDataParaISO(dataAplic);
  const dataVencStr = formatarDataParaISO(dataVenc);
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

const SYSTEM_PROMPT = `Você é um especialista financeiro. Serão fornecidas uma ou mais imagens de extratos de investimento.

CONSOLIDE as informações de TODAS as imagens enviadas em um único array de investimentos. Se o mesmo investimento (mesmo ativo/nome) aparecer em mais de uma imagem, combine os dados em um único objeto, priorizando os valores mais completos.

Formato de cada objeto:
{
  "nome": "Nome do ativo",
  "valor_aplicado": 0.00,
  "data_aplicacao": "AAAA-MM-DD",
  "data_vencimento": "AAAA-MM-DD",
  "tipo_liquidez": "No Vencimento" ou "D+0" ou "D+30",
  "categoria": "Flipping" ou "Reserva" ou "Longo Prazo"
}

Regras:
- valor_aplicado: apenas o número, use ponto para decimais (ex: 50000.00)
- categoria: infira com base no nome do ativo ou data de vencimento
- Retorne sempre um JSON: {"investimentos": [...]} com o array consolidado
- Se você não conseguir encontrar um campo, retorne null para ele. Não invente dados.
- Se não houver investimentos em nenhuma imagem, retorne {"investimentos": []}.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada" },
      { status: 500 }
    );
  }

  let images: Array<{ base64: string; mimeType: string }>;
  try {
    const body = await request.json();
    if (Array.isArray(body.images)) {
      images = body.images.filter(
        (img: unknown) =>
          img &&
          typeof img === "object" &&
          typeof (img as Record<string, unknown>).base64 === "string"
      ).map((img: Record<string, unknown>) => ({
        base64: String(img.base64),
        mimeType: typeof img.mimeType === "string" ? img.mimeType : "image/jpeg",
      }));
    } else if (typeof body.image === "string") {
      images = [{
        base64: body.image,
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "image/jpeg",
      }];
    } else {
      images = [];
    }
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  if (images.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma imagem fornecida" },
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

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
        ...userContent,
        { type: "text", text: "Extraia os dados das imagens acima e retorne em formato json." },
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Resposta do modelo não é JSON válido" },
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

    return NextResponse.json({ dados: resultados });
  } catch (err) {
    console.error("Erro ao extrair imagem:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao processar imagem" },
      { status: 500 }
    );
  }
}
