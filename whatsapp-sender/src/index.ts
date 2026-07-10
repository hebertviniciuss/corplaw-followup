import "dotenv/config";
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import type { Boom } from "@hapi/boom";
import { Redis } from "@upstash/redis";
import pino from "pino";
import qrcode from "qrcode-terminal";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });

const GROUPS_KEY = "corplaw:whatsapp:groups";
const GROUPS_UPDATED_AT_KEY = "corplaw:whatsapp:groups-updated-at";
const QUEUE_KEY = "corplaw:whatsapp:queue";
const JOB_KEY_PREFIX = "corplaw:whatsapp:job:";
const JOB_TTL_SECONDS = 60 * 60;
const GROUPS_REFRESH_MS = 60_000;
const QUEUE_POLL_MS = 3_000;

const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;

if (!redisUrl || !redisToken) {
  logger.error("Configure KV_REST_API_URL e KV_REST_API_TOKEN no arquivo .env (mesmos valores do site).");
  process.exit(1);
}

const redis = new Redis({ url: redisUrl, token: redisToken });

type SendJob = {
  id: string;
  groupId: string;
  clientName: string;
  message: string;
};

type JobStatus = {
  status: "sent" | "failed";
  error?: string;
  finishedAt: string;
};

async function refreshGroups(sock: ReturnType<typeof makeWASocket>) {
  try {
    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups).map((g) => ({ id: g.id, name: g.subject }));
    await redis.set(GROUPS_KEY, list);
    await redis.set(GROUPS_UPDATED_AT_KEY, new Date().toISOString());
    logger.info(`Grupos atualizados: ${list.length} encontrados.`);
  } catch (err) {
    logger.error({ err }, "Falha ao buscar grupos do WhatsApp.");
  }
}

async function processNextJob(sock: ReturnType<typeof makeWASocket>) {
  const job = await redis.lpop<SendJob>(QUEUE_KEY);
  if (!job) return;

  try {
    await sock.sendMessage(job.groupId, { text: job.message });
    const status: JobStatus = { status: "sent", finishedAt: new Date().toISOString() };
    await redis.set(`${JOB_KEY_PREFIX}${job.id}`, status, { ex: JOB_TTL_SECONDS });
    logger.info(`Mensagem enviada para ${job.clientName} (${job.groupId}).`);
  } catch (err) {
    const status: JobStatus = {
      status: "failed",
      error: err instanceof Error ? err.message : "Erro desconhecido",
      finishedAt: new Date().toISOString(),
    };
    await redis.set(`${JOB_KEY_PREFIX}${job.id}`, status, { ex: JOB_TTL_SECONDS });
    logger.error({ err }, `Falha ao enviar mensagem para ${job.clientName}.`);
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({ auth: state });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Escaneie o QR code abaixo com o WhatsApp do número dedicado:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn(`Conexão encerrada. Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        start();
      } else {
        logger.error("Sessão desconectada (logout). Apague a pasta 'auth' e rode novamente para reautenticar.");
      }
    } else if (connection === "open") {
      logger.info("Conectado ao WhatsApp com sucesso!");
      void refreshGroups(sock);
      setInterval(() => void refreshGroups(sock), GROUPS_REFRESH_MS);
      setInterval(() => void processNextJob(sock), QUEUE_POLL_MS);
    }
  });
}

start();
