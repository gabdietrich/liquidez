/**
 * Cálculo de IR Regressivo para investimentos em Renda Fixa
 * Baseado na data de aplicação (tempo de permanência)
 *
 * Até 180 dias: 22,5%
 * 181 a 360 dias: 20%
 * 361 a 720 dias: 17,5%
 * Acima de 720 dias: 15%
 */

export const ALÍQUOTAS_IR = {
  ate180: 0.225,
  ate360: 0.2,
  ate720: 0.175,
  acima720: 0.15,
} as const;

export function calcularAliquotaIR(diasPermanencia: number): number {
  if (diasPermanencia <= 180) return ALÍQUOTAS_IR.ate180;
  if (diasPermanencia <= 360) return ALÍQUOTAS_IR.ate360;
  if (diasPermanencia <= 720) return ALÍQUOTAS_IR.ate720;
  return ALÍQUOTAS_IR.acima720;
}

export function calcularIRRegressivo(
  valorBruto: number,
  valorAplicado: number,
  dataAplicacao: Date,
  dataResgate: Date
): { ir: number; aliquota: number; valorLiquido: number } {
  const lucro = valorBruto - valorAplicado;
  if (lucro <= 0) {
    return { ir: 0, aliquota: 0, valorLiquido: valorBruto };
  }

  const diasPermanencia = Math.floor(
    (dataResgate.getTime() - dataAplicacao.getTime()) / (1000 * 60 * 60 * 24)
  );
  const aliquota = calcularAliquotaIR(diasPermanencia);
  const ir = lucro * aliquota;
  const valorLiquido = valorBruto - ir;

  return { ir, aliquota, valorLiquido };
}

export function getDiasPermanencia(dataAplicacao: string, dataResgate: string): number {
  const aplicacao = new Date(dataAplicacao);
  const resgate = new Date(dataResgate);
  return Math.floor(
    (resgate.getTime() - aplicacao.getTime()) / (1000 * 60 * 60 * 24)
  );
}
