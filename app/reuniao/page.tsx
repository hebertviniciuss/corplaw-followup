"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { findMention } from "@/lib/matching";
import { isAlwaysFollowupStatus } from "@/lib/status-groups";
import type { Portfolio } from "@/lib/portfolio";
import FollowupResults, { type FollowupResult, type FollowupSection } from "@/components/FollowupResults";

function todayIsoDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

type PendingResult = Omit<FollowupResult, "message">;

export default function ReuniaoPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [meetingDate, setMeetingDate] = useState(todayIsoDate());
  const [fileName, setFileName] = useState<string | null>(null);
  const [results, setResults] = useState<FollowupResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      const transcript = await file.text();

      const portfolioRes = await fetch("/api/portfolio");
      const portfolio: Portfolio | null = await portfolioRes.json();

      if (!portfolio || portfolio.clients.length === 0) {
        throw new Error(
          "A carteira de clientes ainda não foi sincronizada. Volte à página inicial e clique em \"Sincronizar agora\"."
        );
      }

      const pending: Array<PendingResult & { demand: string; excerptToday: string | null }> = portfolio.clients
        .map((client) => {
          const mention = findMention(transcript, client.clientName);
          const alwaysFollowup = isAlwaysFollowupStatus(client.activeStatus);

          if (!alwaysFollowup && !mention.found) return null;

          const section: FollowupSection = !alwaysFollowup
            ? "outside-active-mentioned"
            : mention.found
              ? "mentioned"
              : "not-mentioned";

          return {
            clientName: client.clientName,
            activeStatus: client.activeStatus,
            mentioned: mention.found,
            section,
            demand: client.demands.map((d) => d.demand).join("; "),
            excerptToday: mention.excerpt,
          };
        })
        .filter((r): r is PendingResult & { demand: string; excerptToday: string | null } => r !== null);

      const generateRes = await fetch("/api/followup/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingDate,
          items: pending.map((p) => ({
            clientName: p.clientName,
            demand: p.demand,
            activeStatus: p.activeStatus,
            mentioned: p.mentioned,
            excerptToday: p.excerptToday,
          })),
        }),
      });

      if (!generateRes.ok) {
        throw new Error("Falha ao gerar as mensagens de follow-up.");
      }

      const { messages } = (await generateRes.json()) as { messages: Record<string, string> };

      const generated: FollowupResult[] = pending.map((p) => ({
        clientName: p.clientName,
        activeStatus: p.activeStatus,
        demand: p.demand,
        mentioned: p.mentioned,
        section: p.section,
        message: messages[p.clientName] ?? "",
      }));

      setResults(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar a transcrição.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-navy/10 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Reunião Operacional — Societário</h1>
        <p className="mt-1 text-sm text-navy/60">
          Inclua a transcrição (.txt) da última reunião operacional para gerar um rascunho de follow-up por cliente
          da carteira.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-navy/70">
            Data da reunião
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="rounded-md border border-navy/20 px-2 py-1.5 text-sm text-navy focus:border-teal focus:outline-none"
            />
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processando…" : "Incluir transcrição (.txt)"}
          </button>
          {fileName && <span className="text-sm text-navy/60">{fileName}</span>}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            {error}{" "}
            <Link href="/" className="underline">
              Ir para a carteira
            </Link>
          </p>
        )}
      </section>

      {results && (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-navy">Follow-ups gerados</h2>
          <FollowupResults results={results} meetingDate={meetingDate} />
        </section>
      )}
    </div>
  );
}
