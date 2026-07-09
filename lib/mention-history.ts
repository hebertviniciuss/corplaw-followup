import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { normalizeText } from "./matching";

const HISTORY_KEY = "corplaw:mention-history";
const LOCAL_HISTORY_FILE = path.join(process.cwd(), ".data", "mention-history.json");

export type MentionRecord = {
  clientName: string;
  meetingDate: string;
  excerpt: string;
};

type HistoryMap = Record<string, MentionRecord>;

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
}
