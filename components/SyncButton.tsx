"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao sincronizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sincronizando…" : "Sincronizar agora"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
