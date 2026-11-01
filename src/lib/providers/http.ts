export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export async function requestJson(url: string, key?: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: key ? { Authorization: key } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      throw new ProviderError(
        "The data provider could not be reached. Your cached matches are safe.",
      );
    }
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      const header = response.headers.get("retry-after");
      const parsed = header
        ? Number(header) || Math.ceil((Date.parse(header) - Date.now()) / 1000)
        : 2 ** attempt;
      const delay = Math.max(
        1,
        Number.isFinite(parsed) ? parsed : 2 ** attempt,
      );
      if (attempt < 2 && delay <= 8) {
        await new Promise((r) => setTimeout(r, delay * 1000));
        continue;
      }
      throw new ProviderError(
        "Provider rate limit or temporary outage. Try again later; cached data is unchanged.",
        503,
        delay,
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new ProviderError(
        "Provider authorization was rejected. Check your server API key and permitted access.",
        503,
      );
    throw new ProviderError(
      `Provider request failed (${response.status}). Cached matches are unchanged.`,
    );
  }
  throw new ProviderError("Data provider unavailable.");
}
