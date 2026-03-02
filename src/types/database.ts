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
}

export interface Database {
  public: {
    Tables: {
      liq_investimentos: {
        Row: Investimento;
        Insert: InvestimentoInsert;
        Update: Partial<InvestimentoInsert>;
      };
    };
  };
}
