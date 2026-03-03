import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `Você é um Mentor Financeiro. Sua tarefa é escrever um resumo narrativo sobre um investimento que foi liquidado.

Escreva exatamente DUAS frases curtas e encorajadoras sobre o desempenho do investimento.

Regras:
- Se a categoria for "Flipping", mencione a eficiência no giro do capital.
- Use linguagem positiva e motivadora.
- Seja conciso: apenas duas frases.
- Não use aspas ou formatação extra no texto.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada" },
      { status: 500 }
    );
  }

  let nome: string;
  let lucro: number;
  let dias_passados: number;
  let categoria: string;

  try {
    const body = await request.json();
    nome = typeof body.nome === "string" ? body.nome : "";
    lucro = typeof body.lucro === "number" ? body.lucro : Number(body.lucro) || 0;
    dias_passados = typeof body.dias_passados === "number"
      ? body.dias_passados
      : Number(body.dias_passados) || 0;
    categoria = typeof body.categoria === "string" ? body.categoria : "";
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  const userPrompt = `Gere o resumo para este investimento liquidado:
- Nome: ${nome}
- Lucro: R$ ${lucro.toFixed(2)}
- Dias em aplicação: ${dias_passados}
- Categoria: ${categoria}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    const summary = content ?? "Investimento liquidado com sucesso.";

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Erro ao gerar resumo:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar resumo" },
      { status: 500 }
    );
  }
}
