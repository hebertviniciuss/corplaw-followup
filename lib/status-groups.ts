import { normalizeText } from "./matching";

/**
 * Status do fluxo ativo de entrega: todo cliente nessas fases entra no
 * follow-up, citado ou não na reunião. Qualquer outro status (encerrado,
 * concluído, retrospectiva, contencioso, solicitar feedback, comercial,
 * stand-by, etc.) só entra se tiver sido citado na reunião.
 */
const ALWAYS_FOLLOWUP_STATUSES = new Set(
  ["ajustes finais", "entrega ao cliente", "minuta", "reuniões", "onboarding"].map(normalizeText)
);

export function isAlwaysFollowupStatus(status: string): boolean {
  return ALWAYS_FOLLOWUP_STATUSES.has(normalizeText(status));
}
