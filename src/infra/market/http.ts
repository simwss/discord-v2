/** A price provider failed in a way the player cannot fix by changing input. */
export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly reason: "unavailable" | "rate_limited" | "forbidden",
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

const TIMEOUT_MS = 4_000;

/**
 * GETs JSON. A 404 returns `null` so callers can treat "no such asset" as an
 * answer rather than a failure; every other problem throws MarketDataError.
 */
export async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch (error) {
    throw new MarketDataError(
      `request failed: ${error instanceof Error ? error.message : String(error)}`,
      "unavailable",
    );
  }

  if (response.status === 404) return null;
  if (response.status === 429) {
    throw new MarketDataError("rate limited by provider", "rate_limited");
  }
  if (response.status === 401 || response.status === 403) {
    throw new MarketDataError(
      `access denied (${response.status})`,
      "forbidden",
    );
  }
  if (!response.ok) {
    throw new MarketDataError(`HTTP ${response.status}`, "unavailable");
  }

  try {
    return await response.json();
  } catch {
    throw new MarketDataError("invalid JSON", "unavailable");
  }
}
