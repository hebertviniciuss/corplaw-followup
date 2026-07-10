"use client";

import { useEffect, useMemo, useState } from "react";
import type { Portfolio } from "@/lib/portfolio";
import type { WhatsAppGroup } from "@/lib/whatsapp";

type MappingMap = Record<string, { groupId: string; groupName: string }>;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function minutesAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function WhatsAppMappingPage() {
  const [clients, setClients] = useState<string[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [mapping, setMapping] = useState<MappingMap>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingClient, setSavingClient] = useState<string | null>(null);

  async function loadData() {
    const [portfolioRes, groupsRes] = await Promise.all([
      fetch("/api/portfolio"),
      fetch("/api/whatsapp/groups"),
    ]);
    const portfolio: Portfolio | null = await portfolioRes.json();
    const groupsData = await groupsRes.json();

    setClients((portfolio?.clients ?? []).map((c) => c.clientName));
    setGroups(groupsData.groups ?? []);
    setMapping(groupsData.mapping ?? {});
    setUpdatedAt(groupsData.updatedAt ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredClients = useMemo(() => {
    const term = normalize(search);
    if (!term) return clients;
    return clients.filter((name) => normalize(name).includes(term));
  }, [clients, search]);

  async function handleMap(clientName: string, groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    setSavingClient(clientName);
    await fetch("/api/whatsapp/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName, groupId: group.id, groupName: group.name }),
    });
    setMapping((prev) => ({ ...prev, [normalize(clientName)]: { groupId: group.id, groupName: group.name } }));
    setSavingClient(null);
  }

  const staleMinutes = minutesAgo(updatedAt);
  const isStale = staleMinutes === null || staleMinutes > 5;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-navy/10 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Vincular clientes a grupos do WhatsApp</h1>
        <p className="mt-1 text-sm text-navy/60">
          Escolha o grupo de WhatsApp correspondente a cada cliente. Isso é usado pelo envio automático de
          follow-ups na página de reunião.
        </p>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className={isStale ? "text-amber-600" : "text-teal-dark"}>●</span>
          <span className="text-navy/70">
            {updatedAt
              ? `Lista de grupos atualizada há ${staleMinutes} min.`
              : "Nenhuma lista de grupos recebida ainda."}
            {isStale && " O serviço local (whatsapp-sender) pode estar offline."}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-navy/10 bg-white p-6 shadow-sm">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-sm rounded-md border border-navy/20 px-3 py-2 text-sm focus:border-teal focus:outline-none"
        />

        {loading ? (
          <p className="text-sm text-navy/60">Carregando…</p>
        ) : (
          <div className="flex flex-col divide-y divide-navy/10">
            {filteredClients.map((clientName) => {
              const current = mapping[normalize(clientName)];
              return (
                <div key={clientName} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="font-medium text-navy">{clientName}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={current?.groupId ?? ""}
                      onChange={(e) => void handleMap(clientName, e.target.value)}
                      className="min-w-[220px] rounded-md border border-navy/20 px-2 py-1.5 text-sm text-navy focus:border-teal focus:outline-none"
                    >
                      <option value="">Selecionar grupo…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    {savingClient === clientName && <span className="text-xs text-navy/50">salvando…</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
