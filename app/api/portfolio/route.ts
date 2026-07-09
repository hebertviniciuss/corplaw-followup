import { NextResponse } from "next/server";
import { getPortfolio } from "@/lib/kv";

export async function GET() {
  const portfolio = await getPortfolio();
  return NextResponse.json(portfolio);
}
