import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();

const MODEL = "claude-sonnet-5";
const CHUNK_SIZE = 20;
const CONCURRENCY = 5;

const PERSONA_SYSTEM_PROMPT = `
Você escreve mensagens de follow-up para clientes do Time Societário da Corplaw, como alguém do time que acompanha o
projeto de perto no dia a dia — não como um parecerista jurídico.

Regras de tom:
- Fale como quem está acompanhando o projeto junto com o cliente, não como quem está avaliando um caso de fora.
- Transmita segurança sem justificar excessivamente.
- Evite juridiquês quando não for necessário.
- Escreva como uma mensagem de WhatsApp real — direta, sem estrutura de e-mail corporativo.
- Evite frases institucionais como "na nossa avaliação", "entendemos que há fundamentos consistentes",
  "reversão da exigência".
- Menos: linguagem jurídica, tom institucional, justificativas excessivas.
- Mais: tom de CS (customer success), proximidade, objetividade, segurança.
- NÃO cite literalmente o trecho da transcrição entre aspas nem mencione "minuto", "trecho da reunião" ou algo do
  tipo — construa a mensagem a partir do que foi discutido, com suas próprias palavras, como quem já sabe do assunto.
- Escreva em português do Brasil.

Seja concreto, não genérico: use os fatos específicos do contexto fornecido (prazos, documentos, próximos passos,
o que falta de cada lado) em vez de frases vagas de tranquilização como "seguimos acompanhando de perto". Se o
contexto tiver uma data prevista, um documento específico ou uma pendência clara, cite isso diretamente.

Formato (siga à risca — é assim que o time realmente escreve):
1. Saudação em linha própria: "Olá, [Nome]! Tudo bem?" quando o cliente é uma pessoa; "Olá, pessoal!" ou
   "Bom dia, pessoal!" quando o nome parece ser de uma empresa/grupo (não force um nome de pessoa numa saudação
   de empresa).
2. Corpo em 1 a 3 parágrafos curtos (1-2 frases cada), separados por uma linha em branco entre eles. Cada
   parágrafo cobre uma ideia: atualização do andamento, próximo passo, ou um pedido/pendência do lado do cliente.
3. Fechamento em linha própria, sempre alguma variação de "Seguimos à disposição!" (ex: "Qualquer dúvida, seguimos
   à disposição!"). Emojis são opcionais e usados com moderação, nunca mais de um por mensagem (ex: 🤝 no fim).

Exemplos reais do estilo esperado (não copie o conteúdo, apenas o formato e o tom):

"Olá, Vicente! Tudo bem?

Passando para saber se vocês conseguiram alinhar internamente aqueles pontos que pretendiam alterar na documentação.

Se já tiverem as mudanças definidas, podem nos encaminhar por aqui que faremos os ajustes necessários.

Seguimos à disposição! 🤝"

"Olá! Atualizando o andamento do plano de incentivo de longo prazo:

Estamos na reta final, com conclusão prevista para esta semana. Em seguida, teremos a nossa reunião de entrega
para apresentar o material e alinhar os detalhes com vocês.

Logo logo encaminharemos as minutas para vocês. Seguimos à disposição!"
`.trim();

const ResultSchema = z.object({
  results: z.array(
    z.object({
      clientName: z.string(),
      message: z.string(),
    })
  ),
});

export type GenerationContext =
  | { type: "mentioned_today"; excerpt: string }
  | { type: "historical_mention"; excerpt: string; date: string }
  | { type: "no_context" };

export type GenerationItem = {
  clientName: string;
  demand: string;
  activeStatus: string;
  context: GenerationContext;
};

function buildUserPrompt(items: GenerationItem[]): string {
  const entries = items.map((item, index) => {
    const lines = [
      `${index + 1}. Cliente: ${item.clientName}`,
      `   Demanda: ${item.demand}`,
      `   Status atual no ClickUp: ${item.activeStatus}`,
    ];

    if (item.context.type === "mentioned_today") {
      lines.push(`   Contexto da reunião de hoje (não citar literalmente): ${item.context.excerpt}`);
    } else if (item.context.type === "historical_mention") {
      lines.push(
        `   Não foi citado hoje. Última reunião em que foi mencionado (${item.context.date}), não citar literalmente: ${item.context.excerpt}`
      );
    } else {
      lines.push(`   Não há registro de menção em nenhuma reunião até agora. Faça um follow-up proativo genérico.`);
    }

    return lines.join("\n");
  });

  return [
    "Gere uma mensagem de follow-up para cada cliente abaixo, seguindo à risca o formato e o tom definidos no system prompt (saudação, parágrafos curtos separados por linha em branco, fechamento com variação de \"Seguimos à disposição!\").",
    "Extraia os fatos concretos do contexto de cada cliente (prazos, documentos, próximos passos, pendências) — não escreva algo genérico se o contexto tiver informação específica para usar.",
    "Responda com um item por cliente, na mesma ordem, usando o clientName exatamente como informado.",
    "",
    entries.join("\n\n"),
  ].join("\n");
}

function fallbackMessage(item: GenerationItem): string {
  if (item.context.type === "mentioned_today") {
    return `Olá, ${item.clientName}! Tudo bem?\n\nPassando para dar um retorno rápido sobre o andamento do seu projeto (${item.demand}).\n\nSeguimos à disposição!`;
  }
  if (item.context.type === "historical_mention") {
    return `Olá, ${item.clientName}! Tudo bem?\n\nRetomando o seu projeto (${item.demand}), que segue em "${item.activeStatus}". Vamos alinhar os próximos passos?\n\nSeguimos à disposição!`;
  }
  return `Olá, ${item.clientName}! Tudo bem?\n\nPassando para um follow-up do seu projeto (${item.demand}), hoje em "${item.activeStatus}". Podemos agendar uma atualização?\n\nSeguimos à disposição!`;
}

async function generateChunk(items: GenerationItem[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: PERSONA_SYSTEM_PROMPT,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ResultSchema),
      },
      messages: [{ role: "user", content: buildUserPrompt(items) }],
    });

    const parsed = response.parsed_output;
    if (!parsed || parsed.results.length !== items.length) {
      throw new Error("Resposta com número de itens diferente do esperado.");
    }

    // Casa pela posição (a ordem é reforçada no prompt), não pelo clientName
    // devolvido pelo modelo — evita descasamento caso o modelo normalize
    // acentos/espaços no nome ao ecoá-lo de volta.
    parsed.results.forEach((entry, index) => {
      results.set(items[index].clientName, entry.message);
    });
  } catch {
    // Falha na API (rede, refusal, parsing) — cai para um rascunho simples
    // em vez de derrubar a geração inteira dessa reunião.
  }

  for (const item of items) {
    if (!results.has(item.clientName)) {
      results.set(item.clientName, fallbackMessage(item));
    }
  }

  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function generateBatchMessages(items: GenerationItem[]): Promise<Map<string, string>> {
  if (items.length === 0) return new Map();

  const chunks = chunk(items, CHUNK_SIZE);
  const chunkResults = await mapWithConcurrency(chunks, CONCURRENCY, generateChunk);

  const merged = new Map<string, string>();
  for (const chunkResult of chunkResults) {
    for (const [clientName, message] of chunkResult) {
      merged.set(clientName, message);
    }
  }
  return merged;
}
