-- ============================================================
-- Migração: Renomear colunas de liq_historico
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Renomear colunas existentes
ALTER TABLE liq_historico RENAME COLUMN valor_bruto_resgate TO valor_resgatado_bruto;
ALTER TABLE liq_historico RENAME COLUMN valor_liquido TO valor_resgatado_liquido;
ALTER TABLE liq_historico RENAME COLUMN resumo_narrativa TO resumo_ai;

-- Adicionar coluna lucro_liquido e popular
ALTER TABLE liq_historico ADD COLUMN IF NOT EXISTS lucro_liquido DECIMAL(15, 2);
UPDATE liq_historico SET lucro_liquido = valor_resgatado_liquido - valor_aplicado WHERE lucro_liquido IS NULL;
ALTER TABLE liq_historico ALTER COLUMN lucro_liquido SET NOT NULL;

-- Opcional: remover coluna ir se não for mais usada
-- ALTER TABLE liq_historico DROP COLUMN IF EXISTS ir;

NOTIFY pgrst, 'reload schema';
