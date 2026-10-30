import { NextRequest, NextResponse } from "next/server";
import { createClickUpTask } from "@/lib/clickup";

type RequestBody = {
  items: Array<{ clientName: string; demand: string; meetingDate: string; message: string }>;
};

type TaskResult =
  | { clientName: string; ok: true; taskId: string; url: string | null }
  | { clientName: string; ok: false; error: string };

/**
 * Cria tasks no ClickUp a partir dos follow-ups gerados na reunião.
 * Opcional: só é acionado quando o usuário marca "Criar tarefas no ClickUp"
 * e seleciona os clientes desejados.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as RequestBody;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Nenhum cliente selecionado." }, { status: 400 });
  }

  const results: TaskResult[] = await Promise.all(
    body.items.map(async (item): Promise<TaskResult> => {
      try {
        const name = `${item.clientName}: Follow-up reunião operacional (${item.meetingDate})`;
        const description = [
          `Follow-up gerado na reunião operacional de ${item.meetingDate}.`,
          item.demand ? `Demanda: ${item.demand}` : null,
          "",
          item.message,
        ]
          .filter((line) => line !== null)
          .join("\n");

        const task = await createClickUpTask({ name, description });
        return { clientName: item.clientName, ok: true, taskId: task.id, url: task.url };
      } catch (error) {
        return {
          clientName: item.clientName,
          ok: false,
          error: error instanceof Error ? error.message : "Erro ao criar a task no ClickUp.",
        };
      }
    })
  );

  return NextResponse.json({ results });
}
