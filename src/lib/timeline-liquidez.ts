import type { Investimento } from "@/types/database";
import { calcularIRRegressivo } from "./ir-regressivo";

export interface MesDisponibilidade {
  ano: number;
  mes: number;
  label: string;
  valorBruto: number;
  valorLiquido: number;
  investimentos: Array<{
    investimento: Investimento;
    valorBruto: number;
    valorLiquido: number;
    ir: number;
  }>;
}

/**
 * Calcula a disponibilidade de liquidez mês a mês para os próximos 2 anos
 * Considera tipo de liquidez (D+0, D+30, No Vencimento) e IR regressivo
 */
export function calcularTimelineLiquidez(
  investimentos: Investimento[],
  dataBase: Date = new Date()
): MesDisponibilidade[] {
  const resultado: MesDisponibilidade[] = [];
  const mapaMeses = new Map<string, MesDisponibilidade>();

  const anoInicio = dataBase.getFullYear();
  const mesInicio = dataBase.getMonth();

  // Gerar 24 meses
  for (let i = 0; i < 24; i++) {
    let ano = anoInicio;
    let mes = mesInicio + i;
    while (mes >= 12) {
      mes -= 12;
      ano++;
    }
    const chave = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    const label = new Date(ano, mes, 1).toLocaleDateString("pt-BR", {
      month: "short",
      year: "numeric",
    });
    mapaMeses.set(chave, {
      ano,
      mes: mes + 1,
      label,
      valorBruto: 0,
      valorLiquido: 0,
      investimentos: [],
    });
  }

  for (const inv of investimentos) {
    const dataVenc = new Date(inv.data_vencimento);
    const dataAplic = new Date(inv.data_aplicacao);

    let dataDisponivel: Date;

    switch (inv.tipo_liquidez) {
      case "D+0":
        dataDisponivel = new Date(dataBase);
        break;
      case "D+30": {
        const data30Dias = new Date(dataAplic);
        data30Dias.setDate(data30Dias.getDate() + 30);
        dataDisponivel = dataBase > data30Dias ? dataBase : data30Dias;
        break;
      }
      case "No Vencimento":
        dataDisponivel = dataVenc;
        break;
      default:
        dataDisponivel = dataVenc;
    }

    // Ignora vencimentos já passados
    if (dataVenc < dataBase) continue;

    const chave = `${dataDisponivel.getFullYear()}-${String(dataDisponivel.getMonth() + 1).padStart(2, "0")}`;
    const mesData = mapaMeses.get(chave);
    if (mesData) {
      const { ir, valorLiquido } = calcularIRRegressivo(
        inv.valor_aplicado,
        inv.valor_aplicado,
        dataAplic,
        dataDisponivel
      );
      mesData.valorBruto += inv.valor_aplicado;
      mesData.valorLiquido += valorLiquido;
      mesData.investimentos.push({
        investimento: inv,
        valorBruto: inv.valor_aplicado,
        valorLiquido,
        ir,
      });
    }
  }

  return Array.from(mapaMeses.values()).sort(
    (a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes)
  );
}
