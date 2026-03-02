# Liquidez Dashboard

App para visualizar janelas de liquidez, vencimentos e rentabilidade real de investimentos.

## Stack

- **Framework:** Next.js (App Router)
- **Estilização:** Tailwind CSS + Shadcn/UI
- **Banco:** Supabase (PostgreSQL)
- **Ícones:** Lucide React

## Setup

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure o Supabase:
   - Crie um projeto em [supabase.com](https://supabase.com)
   - Copie `.env.example` para `.env.local`
   - Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Execute o script `supabase/EXECUTAR_NO_SUPABASE.sql` no SQL Editor do Supabase
   - Para extração com IA: configure `OPENAI_API_KEY` e opcionalmente `OPENAI_MODEL` (padrão: gpt-4o)

3. Rode o app:
   ```bash
   npm run dev
   ```

## Funcionalidades

- **Input Inteligente:** Cole o extrato bancário em um textarea; usa GPT-4o para extrair investimentos de texto livre. Fallback para regex se a API não estiver configurada.
- **Timeline de Liquidez:** Dashboard mostrando quanto terá disponível mês a mês nos próximos 2 anos.
- **IR Regressivo:** Cálculo automático conforme tempo de permanência:
  - Até 180 dias: 22,5%
  - 181 a 360 dias: 20%
  - 361 a 720 dias: 17,5%
  - Acima de 720 dias: 15%

## Deploy no Netlify

1. **Crie um repositório Git** (se ainda não tiver):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/liquidez-dashboard.git
   git push -u origin main
   ```

2. **Conecte ao Netlify:**
   - Acesse [app.netlify.com](https://app.netlify.com)
   - "Add new site" → "Import an existing project"
   - Conecte seu GitHub/GitLab e selecione o repositório
   - Netlify detecta Next.js automaticamente

3. **Configure as variáveis de ambiente** (Site settings → Environment variables):
   | Variável | Valor |
   |----------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sua chave anon |
   | `OPENAI_API_KEY` | sua chave OpenAI |
   | `OPENAI_MODEL` | `gpt-4o` (opcional) |

4. **Deploy** — Netlify faz o build e publica automaticamente.

**Alternativa: Netlify CLI** (deploy rápido sem Git):
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --build --prod
```
Configure as variáveis em Site settings → Environment variables após o primeiro deploy.

---

## Schema (liq_investimentos)

| Campo           | Tipo    | Descrição                          |
|----------------|---------|------------------------------------|
| nome           | TEXT    | Nome do investimento               |
| valor_aplicado | DECIMAL | Valor aplicado                     |
| cnpj_fundo     | TEXT    | CNPJ do fundo (opcional)           |
| data_aplicacao | DATE    | Data da aplicação                  |
| data_vencimento| DATE    | Data do vencimento                  |
| tipo_liquidez  | TEXT    | D+0, D+30, No Vencimento           |
| categoria      | TEXT    | Reserva, Longo Prazo, Flipping     |
