const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

export const SOCIETARIO_LIST_ID =
  process.env.CLICKUP_LIST_ID ?? "901305341102";

export type ClickUpTask = {
  id: string;
  name: string;
  status: string;
  dateUpdated: string | null;
  ultimaReuniao: string | null;
  kickoff: string | null;
};

type RawTask = {
  id: string;
  name: string;
  date_updated: string | null;
  status: { status: string } | null;
  custom_fields: Array<{
    name: string;
    value: unknown;
  }>;
};

function customFieldValue(task: RawTask, fieldName: string): string | null {
  const field = task.custom_fields.find((f) => f.name === fieldName);
  if (!field || field.value === null || field.value === undefined || field.value === "") {
    return null;
  }
  return String(field.value);
}

async function clickupFetch(path: string): Promise<unknown> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    throw new Error("CLICKUP_API_TOKEN não configurado no ambiente.");
  }

  const res = await fetch(`${CLICKUP_API_BASE}${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${body}`);
  }

  return res.json();
}

/** Busca todas as tasks da lista, paginando 100 por vez. */
export async function fetchAllTasks(
  listId: string = SOCIETARIO_LIST_ID
): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];
  let page = 0;

  while (true) {
    const data = (await clickupFetch(
      `/list/${listId}/task?page=${page}&limit=100&include_closed=true`
    )) as { tasks: RawTask[]; last_page?: boolean };

    for (const raw of data.tasks) {
      tasks.push({
        id: raw.id,
        name: raw.name,
        status: raw.status?.status ?? "sem status",
        dateUpdated: raw.date_updated,
        ultimaReuniao: customFieldValue(raw, "Data da Última Reunião"),
        kickoff: customFieldValue(raw, "Data da KickOff"),
      });
    }

    if (data.last_page || data.tasks.length === 0) break;
    page += 1;
  }

  return tasks;
}

export type ParsedClient = {
  clientName: string;
  demand: string;
};

/** Títulos de task que não representam um cliente real. */
const NON_CLIENT_NAMES = new Set([
  "demandas extras",
  "advogados externos",
  "corplaw",
]);

/**
 * Extrai o nome do cliente do título da task. Padrões observados na lista:
 *   "Empresa: demanda"
 *   "Pessoa: demanda"
 *   "Pessoa | Empresa: demanda"
 *   "Pessoa (Empresa): demanda"
 */
export function parseClientFromTaskName(name: string): ParsedClient | null {
  const colonIndex = name.indexOf(":");
  if (colonIndex === -1) return null;

  const clientSegment = name.slice(0, colonIndex).trim();
  const demand = name.slice(colonIndex + 1).trim();
  if (!clientSegment) return null;

  if (NON_CLIENT_NAMES.has(clientSegment.toLowerCase())) return null;

  let clientName = clientSegment;

  const pipeIndex = clientSegment.indexOf("|");
  if (pipeIndex !== -1) {
    // "Pessoa | Empresa" -> a empresa é o nome de exibição do cliente
    clientName = clientSegment.slice(pipeIndex + 1).trim();
  } else {
    const parenMatch = clientSegment.match(/\(([^)]+)\)/);
    if (parenMatch) {
      // "Pessoa (Empresa)" -> a empresa é o nome de exibição do cliente
      clientName = parenMatch[1].trim();
    }
  }

  return { clientName, demand };
}
