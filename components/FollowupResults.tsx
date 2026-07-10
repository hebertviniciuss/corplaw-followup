"use client";

import { useState } from "react";

export type FollowupSection = "mentioned" | "not-mentioned" | "outside-active-mentioned";

export type FollowupResult = {
  clientName: string;
  activeStatus: string;
  mentioned: boolean;
  message: string;
  section: FollowupSection;
};

type SendState =
  | { kind: "idle" }
  | { kind: "queued" }
  | { kind: "sent" }
  | { kind: "failed"; error: string }
  | { kind: "no_group" };

function SendBadge({ state }: { state: SendState }) {
  switch (state.kind) {
    case "queued":
      return <span className="text-xs text-navy/50">enviando…</span>;
    case "sent":
      return <span className="text-xs font-medium text-teal-dark">enviado ✅</span>;
    case "failed":
      return <span className="text-xs font-medium text-red-600">falhou ❌ ({state.error})</span>;
    case "no_group":
      return (
        <a href="/whatsapp" className="text-xs font-medium text-amber-600 underline">
          sem grupo vinculado ⚠️
        </a>
      );
    default:
      return null;
  }
}

function FollowupRow({
  result,
  message,
  onMessageChange,
  selected,
  onToggleSelect,
  sendState,
}: {
  result: FollowupResult;
  message: string;
  onMessageChange: (value: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
  sendState: SendState;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-navy/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 accent-teal"
            aria-label={`Selecionar ${result.clientName}`}
          />
          <h3 className="font-semibold text-navy">{result.clientName}</h3>
          <span className="text-xs text-navy/50">Status: {result.activeStatus}</span>
          <SendBadge state={sendState} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-teal px-3 py-1 text-xs font-medium text-teal-dark transition-colors hover:bg-teal-light"
          >
            {copied ? "Copiado!" : "Copiar mensagem"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[#25D366] px-3 py-1 text-xs font-medium text-[#128C7E] transition-colors hover:bg-[#25D366]/10"
          >
            Abrir no WhatsApp
          </a>
        </div>
      </div>
      <textarea
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        rows={5}
        className="w-full resize-y rounded-md border border-navy/10 bg-teal-light/30 p-3 text-sm text-navy focus:border-teal focus:outline-none"
      />
    </div>
  );
}

const SECTION_META: Record<
  FollowupSection,
  { title: string; helper: string; accent: string }
> = {
  mentioned: {
    title: "Mencionados na Reunião",
    helper: "Clientes do fluxo ativo que foram citados na transcrição.",
    accent: "border-teal-dark",
  },
  "not-mentioned": {
    title: "Não Mencionados na Reunião — revisão necessária",
    helper: "Clientes do fluxo ativo que não apareceram na transcrição. Vale uma checagem humana antes de enviar.",
    accent: "border-amber-500",
  },
  "outside-active-mentioned": {
    title: "Fora do fluxo ativo, mas mencionados na reunião",
    helper:
      "Clientes em fases encerradas/passivas (concluído, encerrado, retrospectiva, contencioso, solicitar feedback, etc.) que voltaram a ser citados na reunião.",
    accent: "border-navy/30",
  },
};

const SECTION_ORDER: FollowupSection[] = ["mentioned", "not-mentioned", "outside-active-mentioned"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function FollowupResults({ results }: { results: FollowupResult[] }) {
  const [messages, setMessages] = useState<Record<string, string>>(() =>
    Object.fromEntries(results.map((r) => [r.clientName, r.message]))
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({});
  const [sending, setSending] = useState(false);

  const bySection = SECTION_ORDER.map((section) => ({
    section,
    items: results.filter((r) => r.section === section),
  })).filter((group) => group.items.length > 0);

  const activeCount = results.filter((r) => r.section !== "outside-active-mentioned").length;
  const mentionedActiveCount = results.filter((r) => r.section === "mentioned").length;

  function toggleSelect(clientName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientName)) next.delete(clientName);
      else next.add(clientName);
      return next;
    });
  }

  async function pollJobs(jobByClient: Record<string, string>) {
    let pending = { ...jobByClient };

    for (let attempt = 0; attempt < 40 && Object.keys(pending).length > 0; attempt++) {
      await sleep(3000);
      const ids = Object.values(pending).join(",");
      const res = await fetch(`/api/whatsapp/status?ids=${encodeURIComponent(ids)}`);
      const { statuses } = (await res.json()) as {
        statuses: Record<string, { status: "pending" | "sent" | "failed"; error?: string }>;
      };

      const stillPending: Record<string, string> = {};
      setSendStates((prev) => {
        const next = { ...prev };
        for (const [clientName, jobId] of Object.entries(pending)) {
          const status = statuses[jobId];
          if (!status || status.status === "pending") {
            stillPending[clientName] = jobId;
          } else if (status.status === "sent") {
            next[clientName] = { kind: "sent" };
          } else {
            next[clientName] = { kind: "failed", error: status.error ?? "erro desconhecido" };
          }
        }
        return next;
      });
      pending = stillPending;
    }
  }

  async function handleBulkSend() {
    const clientNames = Array.from(selected);
    if (clientNames.length === 0) return;

    setSending(true);
    setSendStates((prev) => {
      const next = { ...prev };
      for (const name of clientNames) next[name] = { kind: "queued" };
      return next;
    });

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: clientNames.map((clientName) => ({ clientName, message: messages[clientName] })),
        }),
      });
      const { results: sendResults } = (await res.json()) as {
        results: Array<
          { clientName: string; ok: true; jobId: string } | { clientName: string; ok: false; error: string }
        >;
      };

      const jobByClient: Record<string, string> = {};
      setSendStates((prev) => {
        const next = { ...prev };
        for (const r of sendResults) {
          if (r.ok) jobByClient[r.clientName] = r.jobId;
          else next[r.clientName] = { kind: "no_group" };
        }
        return next;
      });

      await pollJobs(jobByClient);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-teal-light/50 p-3">
        <p className="text-sm text-navy/70">
          <strong className="text-teal-dark">{mentionedActiveCount}</strong> de {activeCount} clientes do fluxo
          ativo foram mencionados na transcrição. <strong className="text-teal-dark">{selected.size}</strong>{" "}
          selecionado(s) para envio automático.
        </p>
        <button
          onClick={handleBulkSend}
          disabled={selected.size === 0 || sending}
          className="rounded-md bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#128C7E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Enviando…" : `Enviar selecionados via WhatsApp (${selected.size})`}
        </button>
      </div>

      {bySection.map(({ section, items }) => {
        const meta = SECTION_META[section];
        return (
          <div key={section} className={`flex flex-col gap-3 border-l-4 pl-4 ${meta.accent}`}>
            <div>
              <h3 className="text-base font-semibold text-navy">
                {meta.title} <span className="font-normal text-navy/50">({items.length})</span>
              </h3>
              <p className="text-xs text-navy/50">{meta.helper}</p>
            </div>
            <div className="flex flex-col gap-4">
              {items.map((result) => (
                <FollowupRow
                  key={result.clientName}
                  result={result}
                  message={messages[result.clientName]}
                  onMessageChange={(value) =>
                    setMessages((prev) => ({ ...prev, [result.clientName]: value }))
                  }
                  selected={selected.has(result.clientName)}
                  onToggleSelect={() => toggleSelect(result.clientName)}
                  sendState={sendStates[result.clientName] ?? { kind: "idle" }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
