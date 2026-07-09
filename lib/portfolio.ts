import { ClickUpTask, parseClientFromTaskName } from "./clickup";
import { normalizeText } from "./matching";

export type Demand = {
  taskId: string;
  demand: string;
  status: string;
  ultimaReuniao: string | null;
  kickoff: string | null;
};

export type PortfolioClient = {
  clientName: string;
  demands: Demand[];
  activeStatus: string;
};

export type Portfolio = {
  clients: PortfolioClient[];
  ignoredTasks: Array<{ taskId: string; name: string }>;
  syncedAt: string;
};

const CLOSED_STATUSES = new Set(["concluído", "encerrado"]);

/** Escolhe qual status representar como "status atual" quando o cliente tem várias demandas. */
function pickActiveStatus(demands: Demand[]): string {
  const open = demands.find((d) => !CLOSED_STATUSES.has(d.status.toLowerCase()));
  return (open ?? demands[demands.length - 1]).status;
}

export function buildPortfolio(tasks: ClickUpTask[]): Omit<Portfolio, "syncedAt"> {
  const clientsByKey = new Map<string, PortfolioClient>();
  const ignoredTasks: Portfolio["ignoredTasks"] = [];

  for (const task of tasks) {
    const parsed = parseClientFromTaskName(task.name);
    if (!parsed) {
      ignoredTasks.push({ taskId: task.id, name: task.name });
      continue;
    }

    const key = normalizeText(parsed.clientName);
    const demand: Demand = {
      taskId: task.id,
      demand: parsed.demand,
      status: task.status,
      ultimaReuniao: task.ultimaReuniao,
      kickoff: task.kickoff,
    };

    const existing = clientsByKey.get(key);
    if (existing) {
      existing.demands.push(demand);
    } else {
      clientsByKey.set(key, {
        clientName: parsed.clientName,
        demands: [demand],
        activeStatus: task.status,
      });
    }
  }

  const clients = Array.from(clientsByKey.values())
    .map((client) => ({
      ...client,
      activeStatus: pickActiveStatus(client.demands),
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"));

  return { clients, ignoredTasks };
}
