import { NextRequest, NextResponse } from "next/server";
import { fetchAllTasks } from "@/lib/clickup";
import { buildPortfolio } from "@/lib/portfolio";
import { savePortfolio } from "@/lib/kv";

async function runSync() {
  const tasks = await fetchAllTasks();
  const { clients, ignoredTasks } = buildPortfolio(tasks);
  const portfolio = await savePortfolio({ clients, ignoredTasks });
  return portfolio;
}

/** Acionado pelo botão "Sincronizar agora" no dashboard. */
export async function POST() {
  try {
    const portfolio = await runSync();
    return NextResponse.json(portfolio);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar com o ClickUp." },
      { status: 500 }
    );
  }
}

/** Acionado pelo Vercel Cron semanal — protegido por CRON_SECRET. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  try {
    const portfolio = await runSync();
    return NextResponse.json(portfolio);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar com o ClickUp." },
      { status: 500 }
    );
  }
}
