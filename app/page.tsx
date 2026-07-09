import Link from "next/link";
import { getPortfolio } from "@/lib/kv";
import SyncButton from "@/components/SyncButton";
import PortfolioTable from "@/components/PortfolioTable";

export const dynamic = "force-dynamic";

function formatSyncedAt(iso: string | undefined): string {
  if (!iso) return "Nunca sincronizado";
  return new Date(iso).toLocaleString("pt-BR");
}

export default async function DashboardPage() {
  const portfolio = await getPortfolio();
  const clients = portfolio?.clients ?? [];
  const ignoredCount = portfolio?.ignoredTasks.length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-navy/10 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-navy">Carteira de Clientes — Societário</h1>
          <p className="mt-1 text-sm text-navy/60">
            Última sincronização com o ClickUp: {formatSyncedAt(portfolio?.syncedAt)}
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-navy/80">
              <strong className="text-teal-dark">{clients.length}</strong> clientes ativos
            </span>
            {ignoredCount > 0 && (
              <span className="text-navy/50">{ignoredCount} tasks ignoradas (sem cliente identificado)</span>
            )}
          </div>
        </div>
        <SyncButton />
      </section>

      <section className="rounded-xl border border-navy/10 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy">Próximo passo</h2>
          <Link
            href="/reuniao"
            className="rounded-md border border-teal px-3 py-1.5 text-sm font-medium text-teal-dark transition-colors hover:bg-teal-light"
          >
            Gerar follow-ups da reunião →
          </Link>
        </div>
        <p className="text-sm text-navy/60">
          Envie a transcrição da última reunião operacional do Time Societário para comparar com a carteira abaixo e
          gerar um rascunho de mensagem para cada cliente.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-navy">Clientes na carteira</h2>
        <PortfolioTable clients={clients} />
      </section>
    </div>
  );
}
