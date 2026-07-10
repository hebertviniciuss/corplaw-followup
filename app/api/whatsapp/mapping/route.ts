import { NextRequest, NextResponse } from "next/server";
import { saveMapping } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { clientName?: string; groupId?: string; groupName?: string };

  if (!body.clientName || !body.groupId || !body.groupName) {
    return NextResponse.json({ error: "clientName, groupId e groupName são obrigatórios." }, { status: 400 });
  }

  await saveMapping(body.clientName, { groupId: body.groupId, groupName: body.groupName });
  return NextResponse.json({ ok: true });
}
