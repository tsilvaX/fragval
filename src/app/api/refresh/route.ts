import { NextResponse } from "next/server";
import { synchronize } from "@/lib/service";
import { ProviderError } from "@/lib/providers/http";
import { allowedOrigin } from "@/lib/origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!allowedOrigin(request, process.env.APP_ORIGIN))
    return NextResponse.json(
      { error: "Refresh must come from this court." },
      { status: 403 },
    );
  try {
    return NextResponse.json(await synchronize(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ProviderError
            ? error.message
            : "Refresh failed. Your cached matches are safe.",
      },
      {
        status: error instanceof ProviderError ? error.status : 500,
        headers:
          error instanceof ProviderError && error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : {},
      },
    );
  }
}
