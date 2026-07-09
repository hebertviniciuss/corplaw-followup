import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Portfolio } from "./portfolio";

const PORTFOLIO_KEY = "corplaw:portfolio";

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Fallback para desenvolvimento local, quando não há Redis (Vercel KV/Upstash)
// configurado nas variáveis de ambiente.
const LOCAL_CACHE_FILE = path.join(process.cwd(), ".data", "portfolio.json");

async function readLocalCache(): Promise<Portfolio | null> {
  try {
    const raw = await readFile(LOCAL_CACHE_FILE, "utf-8");
    return JSON.parse(raw) as Portfolio;
  } catch {
    return null;
  }
}

async function writeLocalCache(portfolio: Portfolio): Promise<void> {
  await mkdir(path.dirname(LOCAL_CACHE_FILE), { recursive: true });
  await writeFile(LOCAL_CACHE_FILE, JSON.stringify(portfolio, null, 2), "utf-8");
}

export async function getPortfolio(): Promise<Portfolio | null> {
  if (redis) {
    return (await redis.get<Portfolio>(PORTFOLIO_KEY)) ?? null;
  }
  return readLocalCache();
}

export async function savePortfolio(
  data: Omit<Portfolio, "syncedAt">
): Promise<Portfolio> {
  const portfolio: Portfolio = { ...data, syncedAt: new Date().toISOString() };

  if (redis) {
    await redis.set(PORTFOLIO_KEY, portfolio);
  } else {
    await writeLocalCache(portfolio);
  }

  return portfolio;
}

export const usingLocalFallback = !redis;
