import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { normalizeText } from "./matching";

const HISTORY_KEY = "corplaw:mention-history";
const FULL_HISTORY_KEY = "corplaw:mention-history-full";
const LOCAL_HISTORY_FILE = path.join(process.cwd(), ".data", "mention-history.json");
const LOCAL_FULL_HISTORY_FILE = path.join(process.cwd(), ".data", "mention-history-full.json");

export type MentionRecord = {
  clientName: string;
  meetingDate: string;
  excerpt: string;
};

type HistoryMap = Record<string, MentionRecord>;

/**
 * Histórico completo: todas as reuniões operacionais em que cada cliente foi
 * citado — nunca sobrescrito, apenas anexado. Alimenta a base de informações
 * de cada cliente.
 */
type FullHistoryMap = Record<string, MentionRecord[]>;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

async function readLocalHistory(): Promise<HistoryMap> {
  try {
    const raw = await readFile(LOCAL_HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as HistoryMap;
  } catch {
    return {};
  }
}

async function writeLocalHistory(history: HistoryMap): Promise<void> {
  await mkdir(path.dirname(LOCAL_HISTORY_FILE), { recursive: true });
  await writeFile(LOCAL_HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

async function readLocalFullHistory(): Promise<FullHistoryMap> {
  try {
    const raw = await readFile(LOCAL_FULL_HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as FullHistoryMap;
  } catch {
    return {};
  }
}

async function writeLocalFullHistory(history: FullHistoryMap): Promise<void> {
  await mkdir(path.dirname(LOCAL_FULL_HISTORY_FILE), { recursive: true });
  await writeFile(LOCAL_FULL_HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

async function readHistory(): Promise<HistoryMap> {
  if (redis) {
    return (await redis.get<HistoryMap>(HISTORY_KEY)) ?? {};
  }
  return readLocalHistory();
}

async function writeHistory(history: HistoryMap): Promise<void> {
  if (redis) {
    await redis.set(HISTORY_KEY, history);
  } else {
    await writeLocalHistory(history);
  }
}

export async function getMentionRecord(clientName: string): Promise<MentionRecord | null> {
  const history = await readHistory();
  return history[normalizeText(clientName)] ?? null;
}

/**
 * Sobrescreve o registro de cada cliente com a menção mais recente — sempre
 * refletindo a última reunião operacional em que o cliente foi citado.
 */
export async function saveMentionRecords(records: MentionRecord[]): Promise<void> {
  if (records.length === 0) return;
  const history = await readHistory();
  for (const record of records) {
    history[normalizeText(record.clientName)] = record;
  }
  await writeHistory(history);
  await appendFullHistory(records);
}

// ---- Histórico completo (todas as reuniões, por cliente) ----

async function readFullHistory(): Promise<FullHistoryMap> {
  if (redis) {
    return (await redis.get<FullHistoryMap>(FULL_HISTORY_KEY)) ?? {};
  }
  return readLocalFullHistory();
}

async function writeFullHistory(history: FullHistoryMap): Promise<void> {
  if (redis) {
    await redis.set(FULL_HISTORY_KEY, history);
  } else {
    await writeLocalFullHistory(history);
  }
}

/** Anexa novas menções ao histórico completo, evitando duplicatas (mesmo cliente + mesma data de reunião). */
export async function appendFullHistory(records: MentionRecord[]): Promise<void> {
  if (records.length === 0) return;
  const history = await readFullHistory();
  for (const record of records) {
    const key = normalizeText(record.clientName);
    const existing = history[key] ?? [];
    const duplicate = existing.some(
      (r) => normalizeText(r.meetingDate) === normalizeText(record.meetingDate) && r.excerpt === record.excerpt
    );
    if (!duplicate) {
      existing.push(record);
      existing.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
      history[key] = existing;
    }
  }
  await writeFullHistory(history);
}

/** Retorna todas as reuniões em que o cliente foi citado, da mais recente para a mais antiga. */
export async function getFullClientHistory(clientName: string): Promise<MentionRecord[]> {
  const history = await readFullHistory();
  return [...(history[normalizeText(clientName)] ?? [])].reverse();
}

/** Resumo do histórico completo: clientes com o total de reuniões registradas. */
export type ClientHistorySummary = {
  clientName: string;
  meetings: number;
  lastMeetingDate: string | null;
};

export async function getFullHistorySummaries(): Promise<ClientHistorySummary[]> {
  const history = await readFullHistory();
  return Object.entries(history)
    .map(([key, records]) => ({
      clientName: records[records.length - 1]?.clientName ?? key,
      meetings: records.length,
      lastMeetingDate: records.length > 0 ? records[records.length - 1].meetingDate : null,
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"));
}
