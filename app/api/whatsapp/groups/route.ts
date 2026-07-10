import { NextResponse } from "next/server";
import { getGroups, getMapping } from "@/lib/whatsapp";

export async function GET() {
  const [{ groups, updatedAt }, mapping] = await Promise.all([getGroups(), getMapping()]);
  return NextResponse.json({ groups, updatedAt, mapping });
}
