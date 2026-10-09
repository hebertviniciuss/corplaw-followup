# Arquitetura atual — Plataforma de Follow-up

> Documento de diagnóstico. Não contém segredos, tokens, connection strings ou credenciais — apenas nomes de
> variáveis e descrição de arquitetura. Para os valores reais, ver `variaveis-de-ambiente.template.md` (nomes
> apenas) e os cofres de segredo de cada ambiente (Vercel / máquina local do `whatsapp-sender`).

## Visão geral

A Plataforma de Follow-up é um app Next.js (App Router) que:

1. Sincroniza a carteira de clientes do ClickUp para um cache.
2. Gera rascunhos de mensagem de follow-up por cliente via Claude (Anthropic), a partir da transcrição de uma
   reunião colada pelo usuário.
3. Permite enviar essas mensagens para o WhatsApp — manualmente (link `wa.me`, sem automação) ou
   automaticamente, para o grupo do cliente, via um processo complementar (`whatsapp-sender`).

Hoje o deploy do app é manual (`vercel --prod` via CLI) — não há integração Git → deploy automática configurada.

## Componentes

| Componente | Onde roda | Responsabilidade |
| --- | --- | --- |
| App Next.js | Vercel (serverless) | Páginas, API routes, geração de mensagem, leitura/escrita do cache |
| Upstash Redis | Gerenciado (Vercel Marketplace) | Único banco de dados hoje: carteira, histórico de menções, grupos de WhatsApp, mapeamento cliente→grupo, fila de envio, status de jobs |
| `whatsapp-sender` | Processo Node.js separado, fora da Vercel (hoje: máquina local do responsável técnico) | Mantém sessão ativa do WhatsApp (biblioteca não-oficial Baileys) e consome a fila de envio |

O `whatsapp-sender` roda fora da Vercel porque precisa manter uma conexão persistente (WebSocket) com o
WhatsApp — algo incompatível com o modelo serverless (funções de vida curta, sem estado entre chamadas).

## Dois mecanismos distintos — não confundir

- **Cron de sincronização** (`vercel.json`, semanal): aciona `GET /api/sync`, que atualiza a carteira de clientes
  vinda do ClickUp no Redis. Não envia nenhuma mensagem.
- **Fila de envio de WhatsApp**: uma lista no Redis. O app grava um item quando alguém seleciona clientes na tela
  de reunião e confirma o envio; o `whatsapp-sender` consome essa lista e efetivamente manda a mensagem.

## Dados mantidos no Redis hoje

- Carteira de clientes sincronizada do ClickUp.
- Histórico da última reunião em que cada cliente foi mencionado (usado como contexto quando o cliente não é
  citado numa reunião nova).
- Lista de grupos de WhatsApp conhecidos (populada pelo `whatsapp-sender`) + carimbo de hora da última atualização.
- Mapeamento cliente → grupo de WhatsApp.
- Fila de envio pendente.
- Status de cada job de envio (enviado / falhou), com expiração automática.

## Serviços e variáveis de ambiente necessários

Ver `variaveis-de-ambiente.template.md` para a lista completa de nomes, finalidade e obrigatoriedade (sem valores).

## Risco conhecido de duplicidade — resumo

O mecanismo atual de consumo da fila (remoção do item antes de confirmar o envio) não garante entrega em caso de
queda do processo no meio do caminho, e não há hoje uma trava durável contra duplo clique. Ver
`operacao-segura-whatsapp.md` para o detalhamento e a proposta de correção.

## Verificação de evidência (nesta etapa)

Confirmado por hash de commit Git (sem alterar nada):

- Repositório pessoal (`hebertviniciuss/corplaw-followup`), HEAD: `2fe2496816e10ad4b22860ed3502175a84a31fda`
- Repositório corporativo (`hebert-corplaw/corplaw-followup`), HEAD: `2fe2496816e10ad4b22860ed3502175a84a31fda`
- Cópia local de trabalho, HEAD: `2fe2496816e10ad4b22860ed3502175a84a31fda`

Os três commits são idênticos — a cópia do código para o repositório corporativo está completa e correta.
