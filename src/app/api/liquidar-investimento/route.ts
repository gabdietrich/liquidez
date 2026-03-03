import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularIRRegressivo } from "@/lib/ir-regressivo";
import { generateResumoNarrativa } from "@/lib/generate-summary";
import type { Investimento } from "@/types/database";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado" },
      { status: 500 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { investimento_id: string; valor_bruto: number };
  try {
    body = await request.json();
    if (!body.investimento_id || typeof body.valor_bruto !== "number") {
      throw new Error("investimento_id e valor_bruto são obrigatórios");
    }
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  const { investimento_id, valor_bruto } = body;

  const { data: investimento, error: fetchError } = await supabase
    .from("liq_investimentos")
    .select("*")
    .eq("id", investimento_id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !investimento) {
    return NextResponse.json(
      { error: "Investimento não encontrado" },
      { status: 404 }
    );
  }

  const inv = investimento as Investimento;
  const dataAplic = new Date(inv.data_aplicacao);
  const dataResgate = new Date();

  const { ir, valorLiquido } = calcularIRRegressivo(
    valor_bruto,
    Number(inv.valor_aplicado),
    dataAplic,
    dataResgate
  );

  let resumo = "";
  try {
    resumo = await generateResumoNarrativa(inv, valor_bruto, ir, valorLiquido, dataResgate);
  } catch (e) {
    console.error("Erro ao gerar resumo:", e);
  }

  const historico = {
    user_id: user.id,
    nome: inv.nome,
    valor_aplicado: inv.valor_aplicado,
    valor_bruto_resgate: valor_bruto,
    ir,
    valor_liquido: valorLiquido,
    cnpj_fundo: inv.cnpj_fundo,
    data_aplicacao: inv.data_aplicacao,
    data_vencimento: inv.data_vencimento,
    data_resgate: dataResgate.toISOString().slice(0, 10),
    tipo_liquidez: inv.tipo_liquidez,
    categoria: inv.categoria,
    resumo_narrativa: resumo || null,
  };

  const { error: insertError } = await supabase
    .from("liq_historico")
    .insert(historico);

  if (insertError) {
    console.error("Erro ao inserir histórico:", insertError);
    return NextResponse.json(
      { error: "Erro ao salvar histórico" },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabase
    .from("liq_investimentos")
    .delete()
    .eq("id", investimento_id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Erro ao remover investimento:", deleteError);
    return NextResponse.json(
      { error: "Erro ao remover investimento" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    valor_liquido: valorLiquido,
    ir,
  });
}
