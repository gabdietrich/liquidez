/**
 * Busca taxas de mercado (CDI, IPCA, SELIC) via APIs gratuitas.
 * CDI: Banco Central (BCB) - série 12 (CDI diário).
 * IPCA: BCB - série 433 (variação mensal).
 * SELIC: BCB - série 432 (meta Selic).
 */

const BCB_BASE = "https://api.bcb.gov.br/dados/serie";
const SGS_CDI_DIARIO = 12;
const SGS_IPCA_MENSAL = 433;
const SGS_SELIC_META = 432;

export interface TaxasMercado {
  cdiDiarioPercentual: number | null;
  cdiAnualizadoAproximado: number | null;
  ipcaMensalPercentual: number | null;
  selicMetaPercentual: number | null;
}

/**
 * Formata data para o BCB (dd/MM/yyyy).
 */
function formatarDataBCB(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Busca últimos N valores de uma série do BCB.
 */
async function fetchSerieBCB(codigo: number, ultimos: number): Promise<Array<{ data: string; valor: string }>> {
  const url = `${BCB_BASE}/bcdata.sgs.${codigo}/dados/ultimos/${ultimos}?formato=json`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Busca taxas de mercado (CDI diário, IPCA mensal, SELIC).
 * CDI diário é usado para calcular rendimento acumulado no período.
 */
export async function fetchTaxasMercado(): Promise<TaxasMercado> {
  const [cdiData, ipcaData, selicData] = await Promise.all([
    fetchSerieBCB(SGS_CDI_DIARIO, 1),
    fetchSerieBCB(SGS_IPCA_MENSAL, 1),
    fetchSerieBCB(SGS_SELIC_META, 1),
  ]);

  const cdiDiario = cdiData[0]?.valor != null ? parseFloat(String(cdiData[0].valor).replace(",", ".")) : null;
  const ipcaMensal = ipcaData[0]?.valor != null ? parseFloat(String(ipcaData[0].valor).replace(",", ".")) : null;
  const selicMeta = selicData[0]?.valor != null ? parseFloat(String(selicData[0].valor).replace(",", ".")) : null;

  const cdiAnualizado =
    cdiDiario != null && !Number.isNaN(cdiDiario)
      ? (Math.pow(1 + cdiDiario / 100, 252) - 1) * 100
      : null;

  return {
    cdiDiarioPercentual: cdiDiario,
    cdiAnualizadoAproximado: cdiAnualizado,
    ipcaMensalPercentual: ipcaMensal,
    selicMetaPercentual: selicMeta,
  };
}

/**
 * Busca CDI diário entre duas datas (para acumular no período).
 * Retorna array de { data, valor } ordenado por data.
 */
export async function fetchCDIDiarioPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<Array<{ data: string; valor: number }>> {
  const [diaI, mesI, anoI] = dataInicio.split("-").map(Number);
  const [diaF, mesF, anoF] = dataFim.split("-").map(Number);
  const inicio = formatarDataBCB(new Date(anoI, mesI - 1, diaI));
  const fim = formatarDataBCB(new Date(anoF, mesF - 1, diaF));
  const url = `${BCB_BASE}/bcdata.sgs.${SGS_CDI_DIARIO}/dados?formato=json&dataInicial=${inicio}&dataFinal=${fim}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: { data: string; valor: string }) => ({
    data: item.data,
    valor: parseFloat(String(item.valor).replace(",", ".")) || 0,
  }));
}

/**
 * Calcula o fator de rendimento acumulado do CDI no período (1 + rendimento).
 * Usa CDI diário do BCB quando disponível; senão aproxima com CDI anualizado.
 */
export async function calcularFatorCDIPeriodo(
  dataInicio: string,
  dataFim: string,
  cdiAnualizadoAproximado?: number | null
): Promise<number> {
  const dias = Math.max(
    0,
    Math.floor(
      (new Date(dataFim + "T12:00:00").getTime() - new Date(dataInicio + "T12:00:00").getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  if (dias === 0) return 1;

  const diarios = await fetchCDIDiarioPeriodo(dataInicio, dataFim);
  if (diarios.length > 0) {
    let fator = 1;
    for (const d of diarios) {
      fator *= 1 + d.valor / 100;
    }
    return fator;
  }

  const cdiAnual = cdiAnualizadoAproximado ?? 13;
  const rendimentoPeriodo = (cdiAnual / 100) * (dias / 365);
  return 1 + rendimentoPeriodo;
}

/**
 * Estima o valor atual de um ativo pós-fixado (ex.: X% do CDI).
 * Fórmula: valor_aplicado * (1 + (CDI_período) * (taxa_contratada/100)).
 * Ex.: 125.5% do CDI → rendimento do ativo = rendimento CDI no período × 1.255.
 */
export function estimarValorAtualCDI(
  valorAplicado: number,
  fatorCDIPeriodo: number,
  taxaContratadaPercentual: number
): number {
  const rendimentoCDIPeriodo = fatorCDIPeriodo - 1;
  const multiplicador = taxaContratadaPercentual / 100;
  const rendimentoAtivo = rendimentoCDIPeriodo * multiplicador;
  return valorAplicado * (1 + rendimentoAtivo);
}

/**
 * Aproximação rápida sem histórico: usa CDI anualizado e dias desde aplicação.
 * valor_atual ≈ valor_aplicado * (1 + (cdi_anual/100) * (dias/365) * (taxa_contratada/100)).
 */
export function estimarValorAtualCDIRapido(
  valorAplicado: number,
  dataAplicacao: string,
  dataReferencia: string,
  cdiAnualizadoPercentual: number,
  taxaContratadaPercentual: number
): number {
  const dias =
    (new Date(dataReferencia + "T12:00:00").getTime() - new Date(dataAplicacao + "T12:00:00").getTime()) /
    (1000 * 60 * 60 * 24);
  if (dias <= 0) return valorAplicado;
  const rendimentoCDIPeriodo = (cdiAnualizadoPercentual / 100) * (dias / 365);
  const rendimentoAtivo = rendimentoCDIPeriodo * (taxaContratadaPercentual / 100);
  return valorAplicado * (1 + rendimentoAtivo);
}
