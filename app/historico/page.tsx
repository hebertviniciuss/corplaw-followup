"use client";

import { useEffect, useState } from "react";

type Summary = { clientName: string; meetings: number; lastMeetingDate: string | null };
type MentionRecord = { clientName: string; meetingDate: string; excerpt: string };

export default function HistoricoPage() {
  const [summaries, setSummaries] = useState<Summary[] | null>(null);
  const [selected, setSelected] = useState<{ clientName: string; records: MentionRecord[] } | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/history");
      const data = (await res.json()) as { clients: Summary[] };
      setSummaries(data.clients ?? []);
    })();
  }, []);

  async function openClient(clientName: string) {
    setLoadingClient(true);
    try {
      const res = await fetch(`/api/history?client=${encodeURIComponent(clientName)}`);
      const data = (await res.json()) as { records: MentionRecord[] };
      setSelected({ clientName, records: data.records ?? [] });
    } finally {
      setLoadingClient(false);
    }
  }

  const filtered = (summaries ?? []).filter((s) =>
    s.clientName.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-navy/10 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Histórico de Reuniões Operacionais</h1>
        <p className="mt-1 text-sm text-navy/60">
          Base de informações acumulada por cliente: todas as reuniões operacionais em que cada cliente foi citado,
          alimentadas automaticamente a cada transcrição processada.
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente…"
          className="mt-4 w-full max-w-sm rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:border-teal focus:outline-none"
        />
      </section>

      {selected ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">
              {selected.clientName}{" "}
              <span className="font-normal text-navy/50">
                — {selected.records.length} reunião(ões) registrada(s)
              </span>
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="rounded-md border border-teal px-3 py-1.5 text-sm font-medium text-teal-dark transition-colors hover:bg-teal-light"
            >
              ← Voltar para a lista
            </button>
          </div>
          {selected.records.length === 0 && (
            <p className="text-sm text-navy/60">Nenhuma reunião registrada ainda para este cliente.</p>
          )}
          <ol className="flex flex-col gap-3">
            {selected.records.map((record, index) => (
              <li
                key={`${record.meetingDate}-${index}`}
                className="flex flex-col gap-1 rounded-lg border border-navy/10 bg-white p-4"
              >
                <span className="text-xs font-medium text-teal-dark">
                  Reunião de {record.meetingDate.split("-").reverse().join("/")}
                </span>
                <p className="whitespace-pre-wrap text-sm text-navy/80">{record.excerpt}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-teal-light text-navy">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Reuniões registradas</th>
                <th className="px-4 py-3 font-semibold">Última menção</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {summaries === null && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-navy/60">
                    Carregando…
                  </td>
                </tr>
              )}
              {summaries !== null && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-navy/60">
                    {summaries.length === 0
                      ? "Nenhum histórico ainda — ele é alimentado quando você processa transcrições de reuniões."
                      : "Nenhum cliente encontrado para a busca."}
                  </td>
                </tr>
              )}
              {filtered.map((summary) => (
                <tr key={summary.clientName}>
                  <td className="px-4 py-3 font-medium">{summary.clientName}</td>
                  <td className="px-4 py-3 text-navy/70">{summary.meetings}</td>
                  <td className="px-4 py-3 text-navy/70">
                    {summary.lastMeetingDate
                      ? summary.lastMeetingDate.split("-").reverse().join("/")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void openClient(summary.clientName)}
                      disabled={loadingClient}
                      className="rounded-md border border-teal px-3 py-1 text-xs font-medium text-teal-dark transition-colors hover:bg-teal-light disabled:opacity-50"
                    >
                      Ver histórico
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
