export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export function retryDelaySeconds(headers: Headers, fallback = 1): number {
  const retry = headers.get("retry-after");
  if (retry !== null) {
    const seconds = Number(retry);
    if (Number.isFinite(seconds) && seconds >= 0)
      return Math.max(1, Math.ceil(seconds));
    const date = Date.parse(retry);
    if (Number.isFinite(date))
      return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (headers.has("x-ratelimit-reset") && Number.isFinite(reset) && reset >= 0)
    return Math.max(1, Math.ceil(reset));
  return Math.max(1, fallback);
}
// Requests can consume background Riot credits as well as their own API call.
// Honor the response's remaining budget across requests sharing this server key.
const resumeAt = new Map<string, number>();
export async function requestJson(url: string, key?: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = key ? (resumeAt.get(key) ?? 0) - Date.now() : 0;
    if (wait > 61000)
      throw new ProviderError(
        "The provider's rate-limit window is still active. Try again after the indicated delay.",
        503,
        Math.ceil(wait / 1000),
      );
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
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
    if (
      key &&
      response.headers.has("x-ratelimit-remaining") &&
      Number(response.headers.get("x-ratelimit-remaining")) <= 0
    )
      resumeAt.set(
        key,
        Date.now() + retryDelaySeconds(response.headers) * 1000,
      );
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      const delay = retryDelaySeconds(response.headers, 2 ** attempt);
      if (key && response.status === 429)
        resumeAt.set(key, Date.now() + delay * 1000);
      if (attempt < 2 && delay <= 60) {
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
