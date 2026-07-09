import { NextRequest, NextResponse } from "next/server";
import { generateBatchMessages, type GenerationContext, type GenerationItem } from "@/lib/anthropic";
import { getMentionRecord, saveMentionRecords, type MentionRecord } from "@/lib/mention-history";

type RequestItem = {
  clientName: string;
  demand: string;
  activeStatus: string;
  mentioned: boolean;
  excerptToday: string | null;
};

type RequestBody = {
  meetingDate: string;
  items: RequestItem[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RequestBody;

  if (!Array.isArray(body.items) || !body.meetingDate) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const generationItems: GenerationItem[] = await Promise.all(
    body.items.map(async (item): Promise<GenerationItem> => {
      let context: GenerationContext;

      if (item.mentioned && item.excerptToday) {
        context = { type: "mentioned_today", excerpt: item.excerptToday };
      } else {
        const record = await getMentionRecord(item.clientName);
        context = record
          ? { type: "historical_mention", excerpt: record.excerpt, date: record.meetingDate }
          : { type: "no_context" };
      }

      return {
        clientName: item.clientName,
        demand: item.demand,
        activeStatus: item.activeStatus,
        context,
      };
    })
  );

  const messages = await generateBatchMessages(generationItems);

  const newRecords: MentionRecord[] = body.items
    .filter((item) => item.mentioned && item.excerptToday)
    .map((item) => ({
      clientName: item.clientName,
      meetingDate: body.meetingDate,
      excerpt: item.excerptToday as string,
    }));
  await saveMentionRecords(newRecords);

  return NextResponse.json({ messages: Object.fromEntries(messages) });
}
