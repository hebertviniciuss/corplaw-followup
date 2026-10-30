import { NextRequest, NextResponse } from "next/server";
import { getFullClientHistory, getFullHistorySummaries } from "@/lib/mention-history";

/** Histórico completo de reuniões operacionais por cliente. */
export async function GET(request: NextRequest) {
  const client = request.nextUrl.searchParams.get("client");

  if (client) {
    const records = await getFullClientHistory(client);
    return NextResponse.json({ clientName: client, records });
  }

  const summaries = await getFullHistorySummaries();
  return NextResponse.json({ clients: summaries });
}
