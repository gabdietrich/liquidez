-- Tabela liq_investimentos para Liquidez Dashboard (prefixo liq_ para evitar conflito com Laszlo)
-- Execute este script no SQL Editor do Supabase (mesmo projeto do Laszlo)

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

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_liq_investimentos_updated_at ON liq_investimentos;
CREATE TRIGGER update_liq_investimentos_updated_at
  BEFORE UPDATE ON liq_investimentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - descomente e ajuste se usar autenticação
-- ALTER TABLE liq_investimentos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for now" ON liq_investimentos FOR ALL USING (true);
