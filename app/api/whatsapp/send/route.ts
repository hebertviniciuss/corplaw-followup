import { NextRequest, NextResponse } from "next/server";
import { enqueueSend, getMappedGroup } from "@/lib/whatsapp";

type SendRequestItem = { clientName: string; message: string };

type SendResult =
  | { clientName: string; ok: true; jobId: string }
  | { clientName: string; ok: false; error: "sem_grupo_vinculado" };

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { items: SendRequestItem[] };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Nenhum cliente selecionado." }, { status: 400 });
  }

  const results: SendResult[] = await Promise.all(
    body.items.map(async (item): Promise<SendResult> => {
      const group = await getMappedGroup(item.clientName);
      if (!group) {
        return { clientName: item.clientName, ok: false, error: "sem_grupo_vinculado" };
      }
      const jobId = await enqueueSend(item.clientName, group.groupId, item.message);
      return { clientName: item.clientName, ok: true, jobId };
    })
  );

  return NextResponse.json({ results });
}
