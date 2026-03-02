-- ============================================================
-- LIQUIDEZ DASHBOARD - Setup da tabela liq_investimentos
-- ============================================================
-- 1. Acesse: https://supabase.com/dashboard
-- 2. Selecione seu projeto
-- 3. Vá em: SQL Editor → New query
-- 4. Cole este script e clique em Run
-- ============================================================

-- Tabela principal
CREATE TABLE IF NOT EXISTS liq_investimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  valor_aplicado DECIMAL(15, 2) NOT NULL CHECK (valor_aplicado >= 0),
  cnpj_fundo TEXT,
  data_aplicacao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  tipo_liquidez TEXT NOT NULL CHECK (tipo_liquidez IN ('D+0', 'D+30', 'No Vencimento')),
  categoria TEXT NOT NULL CHECK (categoria IN ('Reserva', 'Longo Prazo', 'Flipping')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_liq_investimentos_data_vencimento ON liq_investimentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_liq_investimentos_data_aplicacao ON liq_investimentos(data_aplicacao);
CREATE INDEX IF NOT EXISTS idx_liq_investimentos_categoria ON liq_investimentos(categoria);
CREATE INDEX IF NOT EXISTS idx_liq_investimentos_tipo_liquidez ON liq_investimentos(tipo_liquidez);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS update_liq_investimentos_updated_at ON liq_investimentos;
CREATE TRIGGER update_liq_investimentos_updated_at
  BEFORE UPDATE ON liq_investimentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Permissões explícitas para o app (chave anon) funcionar
GRANT ALL ON TABLE public.liq_investimentos TO anon;
GRANT ALL ON TABLE public.liq_investimentos TO authenticated;
GRANT ALL ON TABLE public.liq_investimentos TO service_role;

-- RLS desabilitado para simplificar (app pessoal). Para produção, habilite e crie policies.
-- ALTER TABLE liq_investimentos ENABLE ROW LEVEL SECURITY;
