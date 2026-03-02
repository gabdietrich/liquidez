-- ============================================================
-- RECRIAR TABELA - Corrige erro "Could not find valor_aplicado"
-- ============================================================
-- A tabela existente pode ter schema diferente. Este script
-- recria a tabela com a estrutura correta.
-- ATENÇÃO: Apaga todos os dados existentes em liq_investimentos!
-- ============================================================

-- 1. Remover tabela antiga
DROP TABLE IF EXISTS liq_investimentos CASCADE;

-- 2. Criar tabela com schema correto
CREATE TABLE liq_investimentos (
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

-- 3. Índices
CREATE INDEX idx_liq_investimentos_data_vencimento ON liq_investimentos(data_vencimento);
CREATE INDEX idx_liq_investimentos_data_aplicacao ON liq_investimentos(data_aplicacao);
CREATE INDEX idx_liq_investimentos_categoria ON liq_investimentos(categoria);
CREATE INDEX idx_liq_investimentos_tipo_liquidez ON liq_investimentos(tipo_liquidez);

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_liq_investimentos_updated_at
  BEFORE UPDATE ON liq_investimentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Permissões
GRANT ALL ON TABLE public.liq_investimentos TO anon;
GRANT ALL ON TABLE public.liq_investimentos TO authenticated;
GRANT ALL ON TABLE public.liq_investimentos TO service_role;

-- 6. Recarregar schema cache do Supabase (API)
NOTIFY pgrst, 'reload schema';
