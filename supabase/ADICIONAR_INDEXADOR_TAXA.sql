-- Adiciona colunas indexador, taxa_contratada e quantidade em liq_investimentos
-- para suportar valor_atual_estimado e informação adicional no dashboard.

ALTER TABLE liq_investimentos ADD COLUMN IF NOT EXISTS indexador TEXT;
ALTER TABLE liq_investimentos ADD COLUMN IF NOT EXISTS taxa_contratada DECIMAL(10, 4);
ALTER TABLE liq_investimentos ADD COLUMN IF NOT EXISTS quantidade INTEGER;

NOTIFY pgrst, 'reload schema';
