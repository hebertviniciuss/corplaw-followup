# Validação, sequência de execução e rollback

> Nenhuma destas etapas foi executada. Este documento define a ordem segura, os critérios de validação e o
> ponto exato de parada para aprovação humana antes de qualquer teste com envio real.

## Sequência de execução em ordem segura

| # | Etapa | Depende de | Risco | Rollback |
| --- | --- | --- | --- | --- |
| 0 | Repositório corporativo | — | Baixo | **Concluída.** Repositório pessoal preservado como referência |
| 1 | Confirmar acesso ao Supabase CorpLaw Pro (ou decidir não usar) | Acesso/decisão humana | Nenhum | N/A |
| 2 | Implementar fila confiável + idempotência durável no Redis (sem mexer em dados existentes) | Nenhuma (só código novo) | Baixo | Reverter o código (Git); a fila atual continua funcionando como está até a troca ser ativada |
| 3 | Testar a fila confiável localmente, sem WhatsApp real (simulando falha do consumidor) | Etapa 2 | Baixo | N/A — é só teste |
| 4 | Script de cópia Redis → Supabase (dados duráveis), sem apagar nada do Redis | Etapa 1 confirmada | Baixo | Redis continua sendo a fonte da verdade |
| 5 | Trocar módulos de acesso a dados (`lib/kv.ts`, `lib/mention-history.ts`, `lib/whatsapp.ts`) para ler/escrever do Supabase | Etapa 4 validada | Médio | Reverter para os arquivos antigos (Git) e apontar de volta para o Redis |
| 6 | **PARADA PARA APROVAÇÃO HUMANA** (ver seção abaixo) | Etapas 1–5 | — | — |
| 7 | Teste de envio controlado, só após aprovação da Etapa 6 | Etapa 6 | Baixo, se os critérios abaixo forem cumpridos | É só um teste — nada a reverter |

## Critérios objetivos antes do teste controlado (Etapa 7)

Todos os itens abaixo devem ser verdadeiros antes de qualquer teste de envio, mesmo controlado:

- [ ] Existe exatamente **um** processo `whatsapp-sender` ativo, e ele aponta para o ambiente de teste (não para
      a fila de produção com clientes reais).
- [ ] O destinatário de teste é um número/grupo técnico autorizado — **nunca** um grupo de cliente real.
- [ ] A fila confiável (Etapa 2/3) está implementada e testada — ou, na ausência dela, o teste é feito com pleno
      conhecimento de que uma falha do processo durante o teste pode exigir reenvio manual.
- [ ] A chave de idempotência está ativa, para confirmar que um duplo clique no teste não gera dois envios.
- [ ] Existe um registro (log ou documento) do estado da fila **antes** do teste começar — quantos jobs pendentes,
      se algum (ver "ponto de pausa" abaixo).

## Ponto exato em que a execução deve parar para aprovação humana

**A execução para, obrigatoriamente, logo após a Etapa 5 (troca dos módulos de acesso a dados) e antes de
qualquer teste de envio (Etapa 7) — mesmo controlado.**

Motivo: as Etapas 0–5 são reversíveis e não enviam nenhuma mensagem real — são seguras para prosseguir conforme
vão sendo confirmadas uma a uma. A Etapa 7 é a primeira que efetivamente aciona o WhatsApp, ainda que para um
destinatário de teste — por isso exige uma confirmação humana explícita, não uma continuação automática.

Nesse ponto de parada, deve-se registrar:

1. Data/hora da parada.
2. Estado da fila de produção no momento (quantidade de jobs pendentes, se houver — hoje, **zero**: o
   `whatsapp-sender` nunca foi executado em produção, então não há jobs pendentes a preservar).
3. Confirmação de que nenhum enviador está ativo apontando para produção durante o período de teste.

## Rollback geral (se algo precisar ser desfeito depois de iniciado)

- **Código**: toda alteração passa por Git — reverter para o commit anterior é sempre possível e não apaga
  histórico.
- **Dados**: a Etapa 4 é uma cópia, não uma migração destrutiva — o Redis nunca é apagado como parte deste plano,
  então reverter para o Redis como fonte de dados é sempre possível até que essa decisão seja tomada
  explicitamente em uma etapa futura, fora deste plano.
- **Fila de envio**: permanece no Redis em todos os cenários deste plano (ver `plano-de-migracao.md`) — não há
  rollback de fila a planejar, porque ela não muda de lugar.
