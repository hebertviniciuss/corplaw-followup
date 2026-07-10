# CorpLaw Follow-up — Time Societário

Site interno que lê a carteira de clientes do ClickUp (Dealmakers: Rotinas → Demandas Societárias), gera follow-ups
por cliente a partir da transcrição da última reunião operacional (usando Claude), e permite enviá-los pelo
WhatsApp — manualmente (link direto) ou automaticamente para o grupo do cliente.

Em produção: **https://corplaw-followup.vercel.app**

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O `.env.local` já contém `CLICKUP_API_TOKEN`, `ANTHROPIC_API_KEY`
e as credenciais do Redis (Upstash).

1. Na tela inicial, clique em **"Sincronizar agora"** para buscar a carteira no ClickUp.
2. Vá em **"Reunião Operacional"**, informe a data da reunião e envie a transcrição (.txt). A transcrição é
   processada inteiramente no navegador — só o trecho relevante de cada cliente citado é enviado ao servidor para
   gerar a mensagem.
3. Cada mensagem gerada pode ser copiada, aberta no WhatsApp (link `wa.me`, manual) ou, se o cliente estiver
   vinculado a um grupo (ver abaixo), enviada automaticamente marcando a caixa de seleção e clicando em "Enviar
   selecionados via WhatsApp".
4. Em **"Grupos WhatsApp"**, vincule cada cliente da carteira ao grupo de WhatsApp correspondente.

## Envio automático para grupos do WhatsApp

O envio automático depende do serviço `whatsapp-sender/` (ver `whatsapp-sender/README.md`), que **não roda na
Vercel** — precisa ficar ligado num computador, conectado a um número de WhatsApp **dedicado** (não o número
principal do escritório, pelo risco de banimento por ser uma automação não-oficial). Sem esse serviço rodando, o
site continua funcionando normalmente — só o envio automático fica indisponível (o botão "Abrir no WhatsApp"
manual sempre funciona).

## Limitações conhecidas

- **Nome do cliente heurístico**: o ClickUp não tem um campo estruturado de "cliente" nessa lista — o nome é extraído
  do título da task (`Empresa: demanda`, `Pessoa | Empresa: demanda`, `Pessoa (Empresa): demanda`). Tasks que não
  seguem esse padrão (ou que são administrativas, como "Demandas Extras") aparecem como "tasks ignoradas" no
  dashboard para revisão manual — ver `lib/clickup.ts` (`parseClientFromTaskName`).
- **Envio via WhatsApp não é oficial**: usa o protocolo do WhatsApp Web (via Baileys) em vez da API oficial da Meta,
  que não suporta envio para grupos. Sem garantia de entrega/suporte.

## Deploy na Vercel

1. `vercel` (ou importe o repositório pelo dashboard da Vercel).
2. No projeto criado, adicione um banco **Redis** (Storage → Marketplace → Upstash for Redis, tem tier gratuito). Ao
   conectar, a Vercel injeta automaticamente `KV_REST_API_URL` e `KV_REST_API_TOKEN` nas env vars do projeto.
3. Em Project Settings → Environment Variables, adicione:
   - `CLICKUP_API_TOKEN` — o Personal API Token do ClickUp.
   - `ANTHROPIC_API_KEY` — API key da Anthropic (console.anthropic.com), usada para gerar as mensagens.
   - `CRON_SECRET` — qualquer string aleatória (usada para proteger o endpoint de sync do cron).
   - Use `vercel env add NOME production --value "..." --yes` em vez de colar via stdin — colar valores por pipe no
     PowerShell pode inserir um caractere invisível (BOM) no início do valor e quebrar chamadas de API.
4. Confirme em Project Settings → Cron Jobs que o job de `vercel.json` (`/api/sync`, toda segunda-feira 08:00 UTC)
   está ativo.
5. Redeploy para aplicar as variáveis.

## Estrutura

- `lib/clickup.ts` — paginação e parsing das tasks do ClickUp.
- `lib/portfolio.ts` — agrega tasks em clientes únicos.
- `lib/kv.ts` — cache da carteira (Redis em produção, arquivo local em dev).
- `lib/matching.ts` — detecção de menções de clientes na transcrição (roda no navegador).
- `lib/anthropic.ts` — geração das mensagens de follow-up via Claude (persona/tom + structured output em lote).
- `lib/mention-history.ts` — última reunião em que cada cliente foi mencionado (fallback para não-mencionados).
- `lib/whatsapp.ts` — grupos, mapeamento cliente→grupo e fila de envio (Redis), consumida pelo `whatsapp-sender/`.
- `app/api/sync` — `POST` (botão manual) e `GET` (cron semanal, protegido por `CRON_SECRET`).
- `app/api/portfolio` — retorna a carteira cacheada para a página `/reuniao`.
- `app/api/followup/generate` — gera as mensagens via Claude para os clientes da reunião.
- `app/api/whatsapp/*` — grupos, mapeamento, envio (enfileira) e status dos jobs de WhatsApp.
- `whatsapp-sender/` — serviço separado (roda localmente, fora da Vercel) que conecta ao WhatsApp e consome a fila.
