# WhatsApp Sender — Corplaw Follow-up

Serviço local que conecta a um número **dedicado** de WhatsApp (não use o número principal do escritório — isso
usa o protocolo do WhatsApp Web via biblioteca não-oficial e o número corre risco de ser banido) e envia as
mensagens de follow-up selecionadas no site para os grupos de clientes correspondentes.

Roda separado do site (que fica na Vercel) porque precisa manter uma conexão contínua com o WhatsApp — algo que
não é possível num ambiente serverless. A comunicação entre o site e este serviço acontece através do mesmo Redis
(Upstash) já usado pelo site: o site grava "pedidos de envio" numa fila, e este serviço processa essa fila.

## Configuração

1. `npm install`
2. Copie `.env.example` para `.env` e preencha `KV_REST_API_URL` / `KV_REST_API_TOKEN` com os mesmos valores do
   `.env.local` do projeto principal (`corplaw-followup/.env.local`), ou copie do dashboard da Vercel em
   Storage → Upstash → `.env.local` tab.
3. `npm start`
4. Na primeira execução, um QR code aparece no terminal. Escaneie com o WhatsApp do número dedicado (Configurações
   → Aparelhos conectados → Conectar um aparelho). A sessão fica salva na pasta `auth/` (gitignored) — não precisa
   escanear de novo nas próximas vezes, a menos que a sessão seja desconectada/deslogada manualmente.

## Mantendo rodando

Este é um processo que precisa ficar ligado para os envios funcionarem. Formas simples de manter rodando:

- Deixar um terminal aberto com `npm start`.
- Ou instalar o [pm2](https://pm2.keymetrics.io/) (`npm install -g pm2`) e rodar `pm2 start npm --name whatsapp-sender -- start`, que reinicia sozinho se cair.

## O que ele faz

- A cada ~1 minuto, busca a lista de grupos que o número participa e salva no Redis (`corplaw:whatsapp:groups`) —
  é essa lista que aparece na página `/whatsapp` do site para vincular cada cliente a um grupo.
- A cada ~3 segundos, verifica se há mensagens pendentes na fila (`corplaw:whatsapp:queue`), envia uma por vez
  (esse intervalo natural entre envios ajuda a evitar que o WhatsApp marque o número como suspeito de spam), e
  grava o resultado (`corplaw:whatsapp:job:<id>`) para o site mostrar o status de envio.

## Avisos

- Isso usa um protocolo não-oficial (via [Baileys](https://github.com/WhiskeySockets/Baileys)) — o WhatsApp pode
  mudar algo a qualquer momento e quebrar o envio; nesse caso, atualizar a dependência `@whiskeysockets/baileys`
  costuma resolver.
- Sem garantia de entrega — trate como uma automação de conveniência, não como canal crítico.
