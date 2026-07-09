import type { PortfolioClient } from "@/lib/portfolio";

export default function PortfolioTable({ clients }: { clients: PortfolioClient[] }) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-navy/60">
        Nenhum cliente sincronizado ainda. Clique em &ldquo;Sincronizar agora&rdquo;.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-navy/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-teal-light text-navy">
          <tr>
            <th className="px-4 py-3 font-semibold">Cliente</th>
            <th className="px-4 py-3 font-semibold">Demanda(s)</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/10">
          {clients.map((client) => (
            <tr key={client.clientName}>
              <td className="px-4 py-3 font-medium">{client.clientName}</td>
              <td className="px-4 py-3 text-navy/70">
                {client.demands.map((d) => d.demand).join("; ")}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-navy/5 px-2 py-1 text-xs font-medium text-navy/80">
                  {client.activeStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
