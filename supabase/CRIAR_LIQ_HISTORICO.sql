-- ============================================================
-- Tabela liq_historico - investimentos liquidados
-- ============================================================
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS liq_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  valor_aplicado DECIMAL(15, 2) NOT NULL,
  valor_bruto_resgate DECIMAL(15, 2) NOT NULL,
  ir DECIMAL(15, 2) NOT NULL DEFAULT 0,
  valor_liquido DECIMAL(15, 2) NOT NULL,
  cnpj_fundo TEXT,
  data_aplicacao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_resgate DATE NOT NULL,
  tipo_liquidez TEXT NOT NULL,
  categoria TEXT NOT NULL,
  resumo_narrativa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que user_id existe (para tabelas criadas antes)
ALTER TABLE liq_historico ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_liq_historico_user_id ON liq_historico(user_id);
CREATE INDEX IF NOT EXISTS idx_liq_historico_data_resgate ON liq_historico(data_resgate);

GRANT ALL ON TABLE public.liq_historico TO anon;
GRANT ALL ON TABLE public.liq_historico TO authenticated;
GRANT ALL ON TABLE public.liq_historico TO service_role;

-- RLS (mesmo padrão de liq_investimentos)
ALTER TABLE liq_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seu histórico" ON liq_historico FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuário insere seu histórico" ON liq_historico FOR INSERT WITH CHECK (auth.uid() = user_id);
