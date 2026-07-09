/** Remove acentos, baixa a caixa e colapsa espaços — usado para comparar nomes. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type Mention = {
  found: boolean;
  excerpt: string | null;
};

/**
 * Procura o nome do cliente na transcrição (case/acento-insensível, com borda
 * de palavra) e retorna um trecho de contexto ao redor da primeira menção.
 */
export function findMention(transcript: string, clientName: string): Mention {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedName = normalizeText(clientName);

  if (normalizedName.length < 3) {
    return { found: false, excerpt: null };
  }

  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normalizedName)}(?![\\p{L}\\p{N}])`, "u");
  const match = pattern.exec(normalizedTranscript);

  if (!match) {
    return { found: false, excerpt: null };
  }

  // Mapeia a posição encontrada no texto normalizado de volta para o texto
  // original aproximando pelo mesmo offset (normalize não muda o comprimento
  // de forma relevante para acentos comuns em PT-BR).
  const start = Math.max(0, match.index - 350);
  const end = Math.min(transcript.length, match.index + normalizedName.length + 350);
  let excerpt = transcript.slice(start, end).trim();

  if (start > 0) excerpt = `…${excerpt}`;
  if (end < transcript.length) excerpt = `${excerpt}…`;

  return { found: true, excerpt };
}
