export type TipoLiquidez = "D+0" | "D+30" | "No Vencimento";
export type Categoria = "Reserva" | "Longo Prazo" | "Flipping";

export interface Investimento {
  id: string;
  nome: string;
  valor_aplicado: number;
  cnpj_fundo: string | null;
  data_aplicacao: string;
  data_vencimento: string;
  tipo_liquidez: TipoLiquidez;
  categoria: Categoria;
  indexador?: string | null;
  taxa_contratada?: number | null;
  quantidade?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface InvestimentoInsert {
  nome: string;
  valor_aplicado: number;
  cnpj_fundo?: string | null;
  data_aplicacao: string;
  data_vencimento: string;
  tipo_liquidez: TipoLiquidez;
  categoria: Categoria;
  indexador?: string | null;
  taxa_contratada?: number | null;
  quantidade?: number | null;
}

export interface HistoricoLiquidacao {
  id: string;
  user_id: string;
  nome: string;
  valor_aplicado: number;
  valor_resgatado_bruto: number;
  valor_resgatado_liquido: number;
  lucro_liquido: number;
  cnpj_fundo: string | null;
  data_aplicacao: string;
  data_vencimento: string;
  data_resgate: string;
  tipo_liquidez: TipoLiquidez;
  categoria: Categoria;
  resumo_ai: string | null;
  created_at?: string;
}

export interface Database {
  public: {
    Tables: {
      liq_investimentos: {
        Row: Investimento;
        Insert: InvestimentoInsert;
        Update: Partial<InvestimentoInsert>;
      };
      liq_historico: {
        Row: HistoricoLiquidacao;
      };
    };
  };
}
