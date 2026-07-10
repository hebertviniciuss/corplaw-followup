import { Redis } from "@upstash/redis";
import { normalizeText } from "./matching";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const GROUPS_KEY = "corplaw:whatsapp:groups";
const GROUPS_UPDATED_AT_KEY = "corplaw:whatsapp:groups-updated-at";
const MAPPING_KEY = "corplaw:whatsapp:mapping";
const QUEUE_KEY = "corplaw:whatsapp:queue";
const JOB_KEY_PREFIX = "corplaw:whatsapp:job:";

export type WhatsAppGroup = { id: string; name: string };

export async function getGroups(): Promise<{ groups: WhatsAppGroup[]; updatedAt: string | null }> {
  const [groups, updatedAt] = await Promise.all([
    redis.get<WhatsAppGroup[]>(GROUPS_KEY),
    redis.get<string>(GROUPS_UPDATED_AT_KEY),
  ]);
  return { groups: groups ?? [], updatedAt: updatedAt ?? null };
}

export type GroupMapping = { groupId: string; groupName: string };
type MappingMap = Record<string, GroupMapping>;

export async function getMapping(): Promise<MappingMap> {
  return (await redis.get<MappingMap>(MAPPING_KEY)) ?? {};
}

export async function saveMapping(clientName: string, group: GroupMapping): Promise<void> {
  const mapping = await getMapping();
  mapping[normalizeText(clientName)] = group;
  await redis.set(MAPPING_KEY, mapping);
}

export async function getMappedGroup(clientName: string): Promise<GroupMapping | null> {
  const mapping = await getMapping();
  return mapping[normalizeText(clientName)] ?? null;
}

export type SendJob = {
  id: string;
  clientName: string;
  groupId: string;
  message: string;
};

export async function enqueueSend(clientName: string, groupId: string, message: string): Promise<string> {
  const id = crypto.randomUUID();
  const job: SendJob = { id, clientName, groupId, message };
  await redis.rpush(QUEUE_KEY, job);
  return id;
}

export type JobStatus =
  | { status: "pending" }
  | { status: "sent"; finishedAt: string }
  | { status: "failed"; error: string; finishedAt: string };

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const status = await redis.get<JobStatus>(`${JOB_KEY_PREFIX}${jobId}`);
  return status ?? { status: "pending" };
}

export async function getJobStatuses(jobIds: string[]): Promise<Record<string, JobStatus>> {
  const entries = await Promise.all(jobIds.map(async (id) => [id, await getJobStatus(id)] as const));
  return Object.fromEntries(entries);
}
