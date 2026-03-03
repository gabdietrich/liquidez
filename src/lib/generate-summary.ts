import OpenAI from "openai";
import type { Investimento } from "@/types/database";

export async function generateResumoNarrativa(
  investimento: Investimento,
  valor_bruto: number,
  ir: number,
  valor_liquido: number,
  data_resgate: Date
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const dataResgateStr = data_resgate.toISOString().slice(0, 10);
  const prompt = `Gere uma narrativa curta (2-4 frases) em português resumindo a liquidação deste investimento. Seja objetivo e profissional.

Dados:
- Ativo: ${investimento.nome}
- Valor aplicado: R$ ${Number(investimento.valor_aplicado).toLocaleString("pt-BR")}
- Data aplicação: ${investimento.data_aplicacao}
- Data vencimento: ${investimento.data_vencimento}
- Valor bruto de resgate: R$ ${valor_bruto.toLocaleString("pt-BR")}
- IR retido: R$ ${ir.toLocaleString("pt-BR")}
- Valor líquido: R$ ${valor_liquido.toLocaleString("pt-BR")}
- Data do resgate: ${dataResgateStr}
- Categoria: ${investimento.categoria}

Retorne APENAS o texto da narrativa, sem aspas ou formatação extra.`;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
