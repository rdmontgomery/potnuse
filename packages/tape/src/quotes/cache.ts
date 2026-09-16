/**
 * A cache in front of the price sources, and the reason there has to be one.
 *
 * Public aggregators rate-limit by IP, and a Cloudflare Worker egresses from
 * addresses shared with every other tenant. So the budget is not ours to
 * spend: we can be refused because of traffic we did not generate, and a cron
 * that asks every minute per market will be refused often.
 *
 * Two behaviours follow. Successful bodies are cached so a firing costs at
 * most one call per source per TTL. And a refusal is cached TOO — briefly —
 * because the worst response to being rate-limited is to retry immediately,
 * which is how a temporary block becomes a persistent one.
 */
export interface CacheEntry {
  body: string;
  status: number;
  storedAt: number;
  expiresAt: number;
}

export interface HttpCache {
  get(key: string): Promise<CacheEntry | null>;
  put(key: string, entry: CacheEntry): Promise<void>;
}

export interface CachePolicy {
  /** How long a good body stays fresh. */
  okMs?: number;
  /** How long to stay away after a 429 or a 5xx. */
  backoffMs?: number;
}

export function memoryCache(): HttpCache & { size: () => number } {
  const entries = new Map<string, CacheEntry>();
  return {
    size: () => entries.size,
    async get(key) {
      return entries.get(key) ?? null;
    },
    async put(key, entry) {
      entries.set(key, entry);
    },
  };
}

/** Rate limited, or upstream having a bad time — both mean wait. */
export function isRefusal(status: number): boolean {
  return status === 429 || status === 403 || status >= 500;
}

export function ttlFor(status: number, policy: CachePolicy = {}): number {
  if (isRefusal(status)) return policy.backoffMs ?? 5 * 60_000;
  return policy.okMs ?? 60_000;
}

/**
 * Fetch through a cache.
 *
 * Returns the cached entry when it is still fresh, including a cached
 * refusal — the caller sees the 429 and can say so, without another request
 * reaching the upstream that issued it.
 */
export async function cachedFetch(
  url: string,
  opts: {
    cache?: HttpCache | null;
    policy?: CachePolicy;
    now?: () => number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{ entry: CacheEntry; fromCache: boolean }> {
  const now = opts.now ?? Date.now;
  const at = now();

  if (opts.cache) {
    const hit = await opts.cache.get(url).catch(() => null);
    if (hit && hit.expiresAt > at) return { entry: hit, fromCache: true };
  }

  const doFetch = opts.fetchImpl ?? fetch;
  let entry: CacheEntry;
  try {
    const response = await doFetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
    });
    const body = await response.text();
    entry = {
      body,
      status: response.status,
      storedAt: at,
      expiresAt: at + ttlFor(response.status, opts.policy),
    };
  } catch (error) {
    // A timeout or a reset is treated like a refusal: back off rather than
    // retry into whatever is already struggling.
    entry = {
      body: error instanceof Error ? error.message : String(error),
      status: 0,
      storedAt: at,
      expiresAt: at + (opts.policy?.backoffMs ?? 5 * 60_000),
    };
  }

  if (opts.cache) await opts.cache.put(url, entry).catch(() => undefined);
  return { entry, fromCache: false };
}
