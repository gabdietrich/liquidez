-- ============================================================
-- CORREÇÃO: Se você já rodou o script e o insert falha
-- Execute este no SQL Editor do Supabase
-- ============================================================

-- 1. Garantir permissões na tabela
GRANT ALL ON TABLE public.liq_investimentos TO anon;
GRANT ALL ON TABLE public.liq_investimentos TO authenticated;
GRANT ALL ON TABLE public.liq_investimentos TO service_role;

-- 2. Desabilitar RLS (permite acesso direto sem policies)
ALTER TABLE liq_investimentos DISABLE ROW LEVEL SECURITY;
