# Variáveis de ambiente — template (sem valores)

> Este arquivo lista apenas nomes, finalidade e onde cada variável é configurada. Nenhum valor, token,
> connection string ou credencial está incluído aqui. Os valores reais ficam exclusivamente nos cofres de
> segredo de cada ambiente (painel da Vercel para o app; arquivo `.env` local, fora do Git, para o
> `whatsapp-sender`).

## App Next.js (Vercel)

| Variável | Finalidade | Onde é configurada | Obrigatória |
| --- | --- | --- | --- |
| `CLICKUP_API_TOKEN` | Autenticação para ler a carteira de clientes no ClickUp | Vercel → Environment Variables (Production) | Sim |
| `CLICKUP_LIST_ID` | ID da lista do ClickUp de onde a carteira é lida | Vercel → Environment Variables (Production) | Sim |
| `ANTHROPIC_API_KEY` | Autenticação com a API da Anthropic (Claude), usada para gerar o texto das mensagens de follow-up | Vercel → Environment Variables (Production) | Sim |
| `CRON_SECRET` | Protege o endpoint de sincronização (`/api/sync`) contra acionamento não autorizado | Vercel → Environment Variables (Production) | Sim |
| `KV_REST_API_URL` | Endpoint do Redis (Upstash) | Injetada automaticamente pela integração Vercel ↔ Upstash | Sim |
| `KV_REST_API_TOKEN` | Token de acesso ao Redis (Upstash) | Injetada automaticamente pela integração Vercel ↔ Upstash | Sim |
| `KV_REST_API_READ_ONLY_TOKEN` | Token de acesso somente leitura ao Redis | Injetada automaticamente pela integração Vercel ↔ Upstash | Não (não usada pelo código hoje) |
| `KV_URL` / `REDIS_URL` | Connection string alternativa (protocolo Redis nativo, não REST) | Injetada automaticamente pela integração Vercel ↔ Upstash | Não (o app usa o cliente REST, não essas) |

### Previstas, se a migração para Supabase for aprovada (ainda não configuradas)

| Variável (proposta) | Finalidade | Onde seria configurada | Obrigatória |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Endpoint do projeto Supabase CorpLaw Pro | Vercel → Environment Variables (Production) | Só se a migração for aprovada |
| `SUPABASE_SERVICE_ROLE_KEY` ou equivalente | Autenticação do backend com o Supabase | Vercel → Environment Variables (Production) | Só se a migração for aprovada |

## `whatsapp-sender` (processo local, fora da Vercel)

| Variável | Finalidade | Onde é configurada | Obrigatória |
| --- | --- | --- | --- |
| `KV_REST_API_URL` | Mesmo Redis usado pelo app — para ler a fila e escrever status | Arquivo `.env` local (fora do Git) | Sim |
| `KV_REST_API_TOKEN` | Token de acesso ao mesmo Redis | Arquivo `.env` local (fora do Git) | Sim |

Além das variáveis de ambiente, o `whatsapp-sender` depende de uma **sessão autenticada do WhatsApp**
(arquivos de sessão da biblioteca Baileys, gerados ao escanear o QR code), persistida em disco na pasta
`whatsapp-sender/auth/` — isso não é uma variável de ambiente e não deve ser versionado nem copiado entre
máquinas; cada máquina que rodar o processo precisa da sua própria sessão autenticada (ou da mesma pasta `auth/`
copiada com cuidado, se a intenção for mover o processo de uma máquina para outra sem reautenticar).
