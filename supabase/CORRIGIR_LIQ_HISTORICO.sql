-- ============================================================
-- CORREÇÃO: Se liq_historico deu erro "column user_id does not exist"
-- Execute este script para recriar a tabela corretamente
-- ATENÇÃO: Apaga todos os dados em liq_historico!
-- ============================================================

DROP TABLE IF EXISTS liq_historico CASCADE;

CREATE TABLE liq_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  valor_aplicado DECIMAL(15, 2) NOT NULL,
  valor_resgatado_bruto DECIMAL(15, 2) NOT NULL,
  valor_resgatado_liquido DECIMAL(15, 2) NOT NULL,
  lucro_liquido DECIMAL(15, 2) NOT NULL,
  cnpj_fundo TEXT,
  data_aplicacao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_resgate DATE NOT NULL,
  tipo_liquidez TEXT NOT NULL,
  categoria TEXT NOT NULL,
  resumo_ai TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_liq_historico_user_id ON liq_historico(user_id);
CREATE INDEX idx_liq_historico_data_resgate ON liq_historico(data_resgate);

GRANT ALL ON TABLE public.liq_historico TO anon;
GRANT ALL ON TABLE public.liq_historico TO authenticated;
GRANT ALL ON TABLE public.liq_historico TO service_role;

ALTER TABLE liq_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seu histórico" ON liq_historico FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuário insere seu histórico" ON liq_historico FOR INSERT WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
