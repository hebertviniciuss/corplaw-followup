# Plano de migração para o padrão corporativo

> Nenhuma ação de migração, deploy, push ou alteração de variáveis foi executada nesta etapa. Este documento é
> só o plano, condicionado às confirmações listadas em cada item.

## 1. Repositório de código — concluído

O código foi copiado do repositório pessoal para `hebert-corplaw/corplaw-followup` (privado, conta corporativa).
Evidência (hash de commit idêntico nos dois repositórios + na cópia local) em `arquitetura-atual.md`.

**Pendente, depende de decisão, não de execução técnica:** se o deploy da Vercel deve passar a usar integração
Git (push-to-deploy) a partir do repositório corporativo, em vez do deploy manual via CLI usado até agora. Não
tem risco técnico relevante — é só uma troca de método de deploy — mas muda o fluxo de trabalho da equipe.

## 2. Dados duráveis — Redis (Upstash) vs. Supabase (Postgres)

### O que está em jogo

Hoje tudo vive no Redis: dados duráveis (carteira, histórico, mapeamento) e a fila de envio (efêmera, por
natureza). A pergunta da adequação corporativa é se isso deve mudar, e para onde.

### Comparação

| Critério | Manter no Redis | Migrar para Supabase (Postgres) |
| --- | --- | --- |
| Dados duráveis (carteira, histórico, mapeamento) | Funciona, mas sem histórico de alterações, sem SQL para auditoria/relatórios, sem backup/retenção padronizados de banco relacional | Ganha: consultas SQL, auditoria, backups geridos, padrão corporativo único de banco de dados |
| Fila de envio (efêmera, um único consumidor) | Padrão natural para fila simples — `LPOP` é atômico, baixa latência, sem overhead de transação SQL | Exigiria `SELECT ... FOR UPDATE SKIP LOCKED` ou mecanismo equivalente para manter a mesma garantia contra duplo consumo — resolve o mesmo problema com mais complexidade, sem ganho claro |
| Registro de idempotência (ver `operacao-segura-whatsapp.md`) | Possível via chave Redis com expiração longa | Mais natural em uma tabela relacional (auditoria, consulta por cliente/data, retenção configurável) |
| Esforço de migração | Nenhum | Script de cópia (sem apagar o Redis) + troca dos módulos de acesso a dados + reteste completo |

### Recomendação (condicionada à confirmação de que o projeto Supabase CorpLaw Pro existe)

- **Migrar para Supabase**: carteira de clientes, histórico de menções, mapeamento cliente→grupo, e o novo
  registro de idempotência/auditoria de envio.
- **Manter no Redis**: a fila de envio em si (`corplaw:whatsapp:queue` e a fila de "em processamento" proposta em
  `operacao-segura-whatsapp.md`).
- **Justificativa**: dados duráveis se beneficiam de um banco relacional (consulta, auditoria, backup
  padronizado); a fila de processamento em tempo real, com um único consumidor, não ganha nada de robustez
  migrando para Postgres e perde simplicidade. Não há razão técnica para mover a fila — só mover o que
  efetivamente se beneficia de SQL.
- **Esta recomendação não deve ser executada sem**: confirmação de que o projeto Supabase existe, acesso
  (connection string ou inclusão direta no projeto) e aprovação humana explícita para iniciar a Etapa 2 do plano
  de execução (`validacao-e-rollback.md`).

## 3. Vercel

A Vercel continua executando somente o app Next.js (páginas + API routes). Ela **nunca** deve executar o
`whatsapp-sender` — isso não é uma configuração a ajustar, é uma incompatibilidade estrutural (processo de
longa duração com conexão persistente vs. funções serverless de vida curta).

"Não criar um segundo enviador" significa, na prática: garantir que exista no máximo **um** processo
`whatsapp-sender` ativo apontando para a fila de produção a qualquer momento, e desligar qualquer instância
antiga antes de ligar uma nova (checklist em `validacao-e-rollback.md`).

## 4. Confiabilidade da fila e idempotência

Tratado em detalhe em `operacao-segura-whatsapp.md` — inclui o comportamento de falha do mecanismo atual
(`LPOP` simples), o mecanismo de fila confiável proposto, e o desenho da chave de idempotência durável.

## Resumo das decisões propostas

1. GitHub: já migrado. Decisão pendente (não bloqueante): trocar para deploy via Git ou manter deploy manual.
2. Dados duráveis: recomendo migrar para Supabase, condicionado à confirmação de acesso.
3. Fila de envio: recomendo manter no Redis, com o mecanismo de confiabilidade/idempotência descrito em
   `operacao-segura-whatsapp.md` — independente de onde os dados duráveis acabem morando.
4. Vercel: nenhuma mudança necessária além de, eventualmente, decidir sobre deploy automático via Git.

## O que ainda depende de acesso ou decisão humana

- Confirmação de que o projeto Supabase CorpLaw Pro existe, e suas credenciais de acesso.
- Decisão sobre deploy manual vs. Git→Vercel automático.
- Formato e método de publicação esperado pelo G4 OS para os documentos desta pasta (fora do escopo técnico desta
  etapa — ver nota em `README` da pasta, se aplicável).
- Destinatário/grupo de WhatsApp de teste autorizado para a Etapa 5 (`validacao-e-rollback.md`).
