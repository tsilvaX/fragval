import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/service";
import { ProviderError } from "@/lib/providers/http";
import { setupStatus } from "@/lib/readiness";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    return NextResponse.json(
      await getDashboard(new URL(request.url).searchParams.get("demo") === "1"),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error(
      "Dashboard load failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      {
        setup: setupStatus(),
        error:
          error instanceof ProviderError
            ? error.message
            : "Could not load the court. Check the database path and server configuration.",
      },
      { status: error instanceof ProviderError ? error.status : 500 },
    );
  }
}
