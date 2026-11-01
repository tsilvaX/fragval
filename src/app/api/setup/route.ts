import { NextResponse } from "next/server";
import { setupStatus } from "@/lib/readiness";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(setupStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
