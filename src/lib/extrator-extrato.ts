/**
 * Extrator Inteligente de Extrato Bancário
 *
 * Usa GPT-4o (ou modelo configurado) para extrair investimentos de texto livre.
 * Fallback para regex quando a API não está disponível.
 */

import type { InvestimentoInsert, TipoLiquidez, Categoria } from "@/types/database";

// Padrões comuns em extratos brasileiros (fallback regex)
const PADROES = {
  valor: /R\$\s*[\d.,]+/g,
  data: /\d{2}\/\d{2}\/\d{4}/g,
  cnpj: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g,
};

function parseValorBrasileiro(str: string): number {
  const limpo = str.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

function parseDataBrasileira(str: string): string {
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

/**
 * Extração por regex - funciona com formatos estruturados
 */
export function extrairInvestimentosRegex(texto: string): InvestimentoInsert[] {
  const linhas = texto.split(/\n/).filter((l) => l.trim());
  const resultados: InvestimentoInsert[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const valores = linha.match(PADROES.valor);
    const datas = linha.match(PADROES.data);
    const cnpj = linha.match(PADROES.cnpj)?.[0] ?? null;

    if (valores && valores.length >= 1 && datas && datas.length >= 2) {
      const valorAplicado = parseValorBrasileiro(valores[0]);
      const dataAplicacao = parseDataBrasileira(datas[0]);
      const dataVencimento = parseDataBrasileira(datas[1]);

      if (valorAplicado > 0 && dataAplicacao && dataVencimento) {
        const nome =
          linha
            .replace(PADROES.valor, "")
            .replace(PADROES.data, "")
            .replace(PADROES.cnpj, "")
            .replace(/\s+/g, " ")
            .trim() || `Investimento ${i + 1}`;

        resultados.push({
          nome: nome.slice(0, 200),
          valor_aplicado: valorAplicado,
          cnpj_fundo: cnpj,
          data_aplicacao: dataAplicacao,
          data_vencimento: dataVencimento,
          tipo_liquidez: inferirTipoLiquidez(linha),
          categoria: inferirCategoria(linha),
        });
      }
    }
  }

  return resultados;
}

function inferirTipoLiquidez(linha: string): TipoLiquidez {
  const lower = linha.toLowerCase();
  if (lower.includes("d+0") || lower.includes("liquidez diária")) return "D+0";
  if (lower.includes("d+30") || lower.includes("30 dias")) return "D+30";
  return "No Vencimento";
}

function inferirCategoria(linha: string): Categoria {
  const lower = linha.toLowerCase();
  if (lower.includes("reserva") || lower.includes("emergência")) return "Reserva";
  if (lower.includes("flip") || lower.includes("flipping")) return "Flipping";
  return "Longo Prazo";
}

/**
 * Extrai investimentos usando IA (GPT-4o ou modelo configurado).
 * O modelo infere categoria com base no nome (padrão: Reserva) e extrai CNPJ se houver.
 * Fallback para regex se a API não estiver configurada ou falhar.
 */
export async function extrairInvestimentosLLM(
  texto: string
): Promise<InvestimentoInsert[]> {
  try {
    const res = await fetch("/api/extrair-extrato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: texto.trim() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Erro ${res.status}`);
    }

    const { dados } = await res.json();
    if (Array.isArray(dados)) {
      return dados;
    }

    return extrairInvestimentosRegex(texto);
  } catch {
    return extrairInvestimentosRegex(texto);
  }
}
