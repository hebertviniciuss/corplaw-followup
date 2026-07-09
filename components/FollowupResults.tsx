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

function FollowupRow({ result }: { result: FollowupResult }) {
  const [message, setMessage] = useState(result.message);
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
          <h3 className="font-semibold text-navy">{result.clientName}</h3>
          <span className="text-xs text-navy/50">Status: {result.activeStatus}</span>
        </div>
        <button
          onClick={handleCopy}
          className="rounded-md border border-teal px-3 py-1 text-xs font-medium text-teal-dark transition-colors hover:bg-teal-light"
        >
          {copied ? "Copiado!" : "Copiar mensagem"}
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
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

export default function FollowupResults({ results }: { results: FollowupResult[] }) {
  const bySection = SECTION_ORDER.map((section) => ({
    section,
    items: results.filter((r) => r.section === section),
  })).filter((group) => group.items.length > 0);

  const activeCount = results.filter((r) => r.section !== "outside-active-mentioned").length;
  const mentionedActiveCount = results.filter((r) => r.section === "mentioned").length;

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-navy/70">
        <strong className="text-teal-dark">{mentionedActiveCount}</strong> de {activeCount} clientes do fluxo ativo
        foram mencionados na transcrição.
      </p>
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
                <FollowupRow key={result.clientName} result={result} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
