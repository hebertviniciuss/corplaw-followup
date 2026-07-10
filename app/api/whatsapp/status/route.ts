import { NextRequest, NextResponse } from "next/server";
import { getJobStatuses } from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids");
  const jobIds = ids ? ids.split(",").filter(Boolean) : [];

  if (jobIds.length === 0) {
    return NextResponse.json({ statuses: {} });
  }

  const statuses = await getJobStatuses(jobIds);
  return NextResponse.json({ statuses });
}
