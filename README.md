# CorpLaw Follow-up — Time Societário

Site interno que lê a carteira de clientes do ClickUp (Dealmakers: Rotinas → Demandas Societárias) e, a partir da
transcrição da última reunião operacional, gera um rascunho de follow-up para cada cliente — comparando quem foi
mencionado na reunião com quem está na carteira.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O `.env.local` já contém o `CLICKUP_API_TOKEN`; sem uma variável
`KV_REST_API_URL`/`KV_REST_API_TOKEN` configurada, a carteira sincronizada é cacheada localmente em `.data/portfolio.json`
(ignorado pelo git).

1. Na tela inicial, clique em **"Sincronizar agora"** para buscar a carteira no ClickUp.
2. Vá em **"Reunião Operacional"**, clique em **"Incluir transcrição (.txt)"** e envie o arquivo da transcrição.
   A transcrição é processada inteiramente no navegador — não é enviada a nenhum servidor.
3. A tabela gerada mostra, para cada cliente da carteira, se ele foi mencionado na reunião e um rascunho de mensagem
   editável (com botão "Copiar").

## Limitações conhecidas

- **Sem LLM externa**: a extração de contexto é feita por busca de nome (normalizada, sem acento) com uma janela de
  texto ao redor da menção — não é um resumo semântico.
- **Nome do cliente heurístico**: o ClickUp não tem um campo estruturado de "cliente" nessa lista — o nome é extraído
  do título da task (`Empresa: demanda`, `Pessoa | Empresa: demanda`, `Pessoa (Empresa): demanda`). Tasks que não
  seguem esse padrão (ou que são administrativas, como "Demandas Extras") aparecem como "tasks ignoradas" no
  dashboard para revisão manual — ver `lib/clickup.ts` (`parseClientFromTaskName`).

## Deploy na Vercel

1. `vercel` (ou importe o repositório pelo dashboard da Vercel).
2. No projeto criado, adicione um banco **Redis** (Storage → Marketplace Database Providers → Upstash/Redis). Ao
   linkar, a Vercel injeta automaticamente `KV_REST_API_URL` e `KV_REST_API_TOKEN` nas env vars do projeto.
3. Em Project Settings → Environment Variables, adicione:
   - `CLICKUP_API_TOKEN` — o Personal API Token do ClickUp (nunca commitar).
   - `CRON_SECRET` — qualquer string aleatória (usada para proteger o endpoint de sync do cron).
4. Confirme em Project Settings → Cron Jobs que o job de `vercel.json` (`/api/sync`, toda segunda-feira 08:00 UTC)
   está ativo.
5. Redeploy para aplicar as variáveis.

## Estrutura

- `lib/clickup.ts` — paginação e parsing das tasks do ClickUp.
- `lib/portfolio.ts` — agrega tasks em clientes únicos.
- `lib/kv.ts` — cache da carteira (Redis em produção, arquivo local em dev).
- `lib/matching.ts` / `lib/followup-templates.ts` — comparação com a transcrição e geração da mensagem.
- `app/api/sync` — `POST` (botão manual) e `GET` (cron semanal, protegido por `CRON_SECRET`).
- `app/api/portfolio` — retorna a carteira cacheada para a página `/reuniao`.
