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

const SYSTEM_PROMPT = `Você é um assistente que extrai dados de investimentos de extratos bancários em texto livre.

Retorne um objeto json com a chave "investimentos" contendo um array. Exemplo: {"investimentos": [...]}. Cada objeto do array deve ter exatamente:
- nome (string): nome do investimento
- valor_aplicado (number): valor em reais (ex: 50000.00)
- data_aplicacao (string): data no formato YYYY-MM-DD
- data_vencimento (string): data no formato YYYY-MM-DD
- tipo_liquidez (string): exatamente um de "D+0", "D+30" ou "No Vencimento"
- categoria (string): exatamente um de "Reserva", "Longo Prazo" ou "Flipping"
- cnpj_fundo (string ou null): CNPJ do fundo se aparecer no texto, senão null

Regras:
- INFIRA a categoria com base no nome/contexto: Tesouro Selic, CDB de reserva, fundos de emergência → "Reserva"; CDB/LCI/LCA de curto prazo, flipping → "Flipping"; demais → "Longo Prazo". Se não conseguir inferir, use "Reserva".
- INFIRA tipo_liquidez: "liquidez diária", "D+0", "resgate imediato" → "D+0"; "D+30", "30 dias" → "D+30"; vencimento fixo → "No Vencimento".
- Extraia CNPJ no formato XX.XXX.XXX/XXXX-XX se houver no texto.
- Datas em DD/MM/AAAA devem ser convertidas para YYYY-MM-DD.
- Valores em R$ X.XXX,XX devem ser números (ex: 50000.00).
- Se não encontrar investimentos, retorne {"investimentos": []}.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada" },
      { status: 500 }
    );
  }

  let texto: string;
  try {
    const body = await request.json();
    texto = typeof body.texto === "string" ? body.texto : "";
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  if (!texto.trim()) {
    return NextResponse.json(
      { error: "Texto vazio" },
      { status: 400 }
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: texto },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
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
    console.error("Erro ao extrair com IA:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao processar extrato" },
      { status: 500 }
    );
  }
}
