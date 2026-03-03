# Schema das tabelas liq_investimentos e liq_historico

## Padronização: valor_aplicado em ambas

### liq_investimentos
| Coluna          | Tipo        | Descrição                    |
|-----------------|-------------|------------------------------|
| id              | UUID        | PK                           |
| user_id         | UUID        | FK auth.users                |
| nome            | TEXT        | Nome do ativo                |
| valor_aplicado  | DECIMAL     | Valor aplicado (padrão)      |
| cnpj_fundo      | TEXT        | CNPJ opcional                |
| data_aplicacao  | DATE        | Data da aplicação            |
| data_vencimento  | DATE        | Data do vencimento           |
| tipo_liquidez   | TEXT        | D+0, D+30, No Vencimento     |
| categoria       | TEXT        | Reserva, Longo Prazo, Flipping |
| created_at      | TIMESTAMPTZ |                              |
| updated_at      | TIMESTAMPTZ |                              |

### liq_historico
| Coluna                   | Tipo        | Descrição                    |
|--------------------------|-------------|------------------------------|
| id                       | UUID        | PK                           |
| user_id                  | UUID        | FK auth.users                |
| nome                     | TEXT        | Nome do ativo                |
| valor_aplicado           | DECIMAL     | Valor aplicado (padrão)      |
| valor_resgatado_bruto    | DECIMAL     | Valor bruto do resgate       |
| valor_resgatado_liquido  | DECIMAL     | Valor líquido após IR        |
| lucro_liquido            | DECIMAL     | valor_resgatado_liquido - valor_aplicado |
| cnpj_fundo               | TEXT        | CNPJ opcional                |
| data_aplicacao           | DATE        | Data da aplicação            |
| data_vencimento          | DATE        | Data do vencimento           |
| data_resgate             | DATE        | Data do resgate              |
| tipo_liquidez            | TEXT        | D+0, D+30, No Vencimento     |
| categoria                | TEXT        | Reserva, Longo Prazo, Flipping |
| resumo_ai                | TEXT        | Resumo gerado por IA        |
| created_at               | TIMESTAMPTZ |                              |

**Fluxo Resgatar:** Investimento (liq_investimentos) → INSERT em liq_historico → DELETE de liq_investimentos.
Ambas as tabelas usam `valor_aplicado` de forma consistente.
