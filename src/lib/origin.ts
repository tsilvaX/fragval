// Next can normalize request.url to localhost even when the browser uses 127.0.0.1.
// Compare against the actual Host header as well; only an explicitly configured
// canonical origin is trusted for a TLS-terminating reverse proxy.
export function allowedOrigin(request: Request, canonical?: string): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const incoming = new URL(origin).origin;
    const url = new URL(request.url);
    const host = request.headers.get("host");
    return (
      incoming === url.origin ||
      (!!host && incoming === `${url.protocol}//${host}`) ||
      (!!canonical && incoming === new URL(canonical).origin)
    );
  } catch {
    return false;
  }
}
