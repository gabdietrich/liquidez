-- ============================================================
-- ADICIONAR user_id e RLS para autenticação
-- ============================================================
-- Execute no SQL Editor do Supabase após ter usuários cadastrados
-- ============================================================

-- 1. Adicionar coluna user_id (referência ao auth.users)
ALTER TABLE liq_investimentos
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Atualizar registros existentes: atribuir ao primeiro usuário (opcional)
-- Descomente e ajuste o UUID se quiser migrar dados antigos:
-- UPDATE liq_investimentos SET user_id = 'SEU_USER_UUID' WHERE user_id IS NULL;

-- 3. Tornar user_id obrigatório para novos registros (após migração)
-- ALTER TABLE liq_investimentos ALTER COLUMN user_id SET NOT NULL;

-- 4. Habilitar RLS
ALTER TABLE liq_investimentos ENABLE ROW LEVEL SECURITY;

-- 5. Remover policies antigas se existirem
DROP POLICY IF EXISTS "Permitir leitura e escrita para anon" ON liq_investimentos;
DROP POLICY IF EXISTS "Usuário vê seus investimentos" ON liq_investimentos;
DROP POLICY IF EXISTS "Usuário insere seus investimentos" ON liq_investimentos;
DROP POLICY IF EXISTS "Usuário atualiza seus investimentos" ON liq_investimentos;
DROP POLICY IF EXISTS "Usuário deleta seus investimentos" ON liq_investimentos;

-- 6. Policies: usuário só vê/edita seus próprios dados
CREATE POLICY "Usuário vê seus investimentos"
  ON liq_investimentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário insere seus investimentos"
  ON liq_investimentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza seus investimentos"
  ON liq_investimentos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário deleta seus investimentos"
  ON liq_investimentos FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Recarregar schema
NOTIFY pgrst, 'reload schema';
