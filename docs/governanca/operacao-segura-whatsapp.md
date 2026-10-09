# Operação segura do envio de WhatsApp — confiabilidade e idempotência

> Este documento é uma proposta de design. Nada aqui foi implementado ou ativado nesta etapa.

## 1. Por que `LPOP` sozinho não é garantia de entrega

O `whatsapp-sender` hoje consome a fila assim: `LPOP` remove o item da lista Redis, e só **depois** disso tenta
enviar a mensagem via WhatsApp e gravar o status.

`LPOP` é atômico — dois processos não conseguem pegar o mesmo item ao mesmo tempo. Mas atomicidade na *remoção*
não é o mesmo que garantia de *entrega*. O problema real:

> Se o processo cair (crash, erro não tratado, falha de rede, reinício da máquina) **depois** do `LPOP` e
> **antes** de confirmar o envio, o job já saiu da fila e não existe mais registro dele em lugar nenhum. A
> mensagem nunca é enviada, e ninguém percebe — é uma perda silenciosa.

Isso é diferente de "duplicidade" (que já está adequadamente prevenida pela atomicidade do `LPOP` entre múltiplos
consumidores) — é **perda**, um risco distinto e não tratado na proposta anterior.

## 2. Mecanismo de fila confiável proposto

Padrão clássico de fila confiável sobre Redis (equivalente ao "visibility timeout" do SQS):

1. Em vez de `LPOP` simples, usar **`LMOVE`** (ou `RPOPLPUSH` em versões mais antigas do Redis) para mover o item,
   atomicamente, da fila principal (`corplaw:whatsapp:queue`) para uma fila de **processamento**
   (`corplaw:whatsapp:processing`), registrando também um carimbo de hora de início.
2. Só remover o item da fila de processamento (`LREM`) **depois** de confirmar sucesso (mensagem enviada) ou
   falha permanente (número de tentativas esgotado).
3. Uma rotina de recuperação (rodando a cada execução do `whatsapp-sender`, e periodicamente em background)
   verifica a fila de processamento: qualquer item parado ali por mais que um tempo limite razoável (ex.: 2
   minutos — tempo bem maior que o necessário para um envio normal) é considerado "o consumidor anterior pode ter
   caído" e é devolvido para o fim da fila principal para nova tentativa, respeitando um número máximo de
   tentativas.
4. Se o número máximo de tentativas for excedido, o job é movido para um estado terminal `failed` (nunca
   descartado silenciosamente) e fica disponível para revisão humana.

Isso elimina a perda silenciosa: todo job está, a qualquer momento, em exatamente um lugar — fila principal, fila
de processamento, ou um registro terminal de sucesso/falha — nunca em lugar nenhum.

## 3. Idempotência durável

### Problema com a proposta anterior

A primeira versão deste diagnóstico sugeria uma checagem de duplicidade por "algumas horas" — insuficiente: não
cobre o caso de alguém reenviar o mesmo follow-up dias depois, nem gera um registro auditável.

### Chave de idempotência proposta

Baseada em dados de negócio, não em um identificador aleatório:

```
idempotency_key = hash(cliente_id + data_da_reuniao + tipo_de_followup + hash_do_conteudo_da_mensagem)
```

- `cliente_id`: identificador estável do cliente (hoje, o nome normalizado — mesma normalização já usada em
  `lib/matching.ts`).
- `data_da_reuniao`: a data informada na tela de reunião (já existe no fluxo atual).
- `tipo_de_followup`: por ora um valor fixo (`"mensagem_reuniao"}`), mas o campo já existe para o caso de surgirem
  outros tipos de follow-up no futuro.
- `hash_do_conteudo_da_mensagem`: hash (ex.: SHA-256) do texto final da mensagem — se o usuário editar o texto
  antes de enviar, isso gera uma chave diferente intencionalmente (é um conteúdo novo, não uma duplicata).

### Estados registrados

Cada chave de idempotência mantém um pequeno registro (ex.: um hash/JSON no Redis, com expiração longa — ex.: 30
dias, não "algumas horas"):

| Campo | Conteúdo |
| --- | --- |
| `state` | Um de: `queued`, `sending`, `sent`, `failed` |
| `job_id` | Identificador do job na fila |
| `created_at` | Data/hora em que o job foi aceito |
| `last_attempt_at` | Data/hora da última tentativa de envio |
| `attempts` | Número de tentativas já feitas |
| `last_error` | Mensagem do último erro, se houver |

### Operação atômica de aceitar um job

No momento de enfileirar (quando o usuário clica em "Enviar selecionados"), a aplicação deve tentar criar o
registro de idempotência de forma atômica — **equivalente a um `SET ... NX`** (seta o valor só se a chave ainda
não existir). Se a chave já existir (mesmo cliente + mesma reunião + mesmo tipo + mesmo conteúdo), o novo pedido
de envio é **rejeitado como duplicado** antes mesmo de entrar na fila — isso é o que impede o duplo clique e o
reprocessamento acidental, de forma determinística (não depende de janela de tempo).

## 4. Resumo do que muda, tecnicamente

| Hoje | Proposta |
| --- | --- |
| `LPOP` direto da fila | `LMOVE` para fila de "processamento" + confirmação antes de remover definitivamente |
| Sem recuperação de job perdido | Rotina de recuperação por tempo limite (visibility timeout) + reenfileiramento com limite de tentativas |
| Dedup por janela curta de horas (ou inexistente) | Chave de idempotência durável baseada em dados de negócio, com expiração de semanas |
| Status só `sent`/`failed` com TTL de 1h | Estados completos (`queued`, `sending`, `sent`, `failed`) com histórico de tentativas, retido por mais tempo |

Nenhuma dessas mudanças exige sair do Redis — todas são possíveis com os comandos atômicos que o Redis já
oferece (`LMOVE`, `SET ... NX`, `LREM`). A decisão de onde registrar o histórico/auditoria de idempotência
(Redis vs. Supabase) está tratada em `plano-de-migracao.md`.
