import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/service";
import { ProviderError } from "@/lib/providers/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await getDashboard(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ProviderError
            ? error.message
            : "Could not load the court. Check the database path and server configuration.",
      },
      { status: error instanceof ProviderError ? error.status : 500 },
    );
  }
}
