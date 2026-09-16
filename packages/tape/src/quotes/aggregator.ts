import { cachedFetch, isRefusal, type CachePolicy, type HttpCache } from './cache.ts';
import { barsIn, byLiquidity, pairsIn } from './parse.ts';
import type { Bar, PairQuote, QuoteSource } from './types.ts';

export interface Endpoint {
  name: string;
  /** URL listing pairs for a token. `{token}` is substituted. */
  pairs?: string;
  /** URL for one pair's candles. `{chain}`, `{pair}` and `{timeframe}` are substituted. */
  bars?: string;
  /** Map a bar width in minutes onto this source's timeframe token. */
  timeframe?: (minutes: number) => string;
}

/**
 * Where to ask, in the order worth asking.
 *
 * None of these shapes have been observed from here — this package is authored
 * without egress — which is exactly why the parser is a tolerant walk and why
 * `probeToken` exists. The list is data: when one of these turns out to be
 * wrong, it is a one-line edit informed by a real response rather than another
 * round of guessing.
 */
export const ENDPOINTS: Endpoint[] = [
  {
    name: 'dexscreener-token',
    pairs: 'https://api.dexscreener.com/latest/dex/tokens/{token}',
  },
  {
    name: 'dexscreener-search',
    pairs: 'https://api.dexscreener.com/latest/dex/search?q={token}',
  },
  {
    name: 'geckoterminal-search',
    pairs: 'https://api.geckoterminal.com/api/v2/search/pools?query={token}',
    bars: 'https://api.geckoterminal.com/api/v2/networks/{chain}/pools/{pair}/ohlcv/{timeframe}',
    timeframe: (minutes) => (minutes >= 1440 ? 'day' : minutes >= 60 ? 'hour' : 'minute'),
  },
];

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (url, [key, value]) => url.replaceAll(`{${key}}`, encodeURIComponent(value)),
    template,
  );

export interface FetchResult {
  endpoint: string;
  url: string;
  status: number | null;
  bytes: number;
  /** Beginning of the response body, for diagnosing a shape nobody has seen. */
  sample: string;
  pairs: PairQuote[];
  bars: Bar[];
  error: string | null;
  /** True when the source refused — rate limit, forbidden, or upstream error. */
  refused: boolean;
  fromCache: boolean;
}

export interface SourceOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  endpoints?: Endpoint[];
  cache?: HttpCache | null;
  policy?: CachePolicy;
  now?: () => number;
}

async function attempt(
  endpoint: string,
  url: string,
  opts: SourceOptions & { sampleBytes?: number },
): Promise<FetchResult> {
  const { entry, fromCache } = await cachedFetch(url, opts);
  const sample = entry.body.slice(0, opts.sampleBytes ?? 1_200);
  const base: FetchResult = {
    endpoint,
    url,
    status: entry.status || null,
    bytes: entry.body.length,
    sample,
    pairs: [],
    bars: [],
    error: null,
    refused: entry.status === 0 || isRefusal(entry.status),
    fromCache,
  };

  if (entry.status === 0) return { ...base, error: entry.body };
  if (entry.status < 200 || entry.status >= 300) {
    return { ...base, error: `HTTP ${entry.status}` };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(entry.body);
  } catch {
    return { ...base, error: 'not JSON' };
  }

  return { ...base, pairs: byLiquidity(pairsIn(payload)), bars: barsIn(payload) };
}

export interface ProbeReport {
  token: string;
  attempts: FetchResult[];
  /** The best pair found anywhere, or null. */
  best: PairQuote | null;
  /**
   * Every source refused. Distinct from "nobody knew this token", which is
   * what the parser failing would mean — blaming the parser for a rate limit
   * sends someone looking in entirely the wrong place.
   */
  allRefused: boolean;
}

/**
 * Ask every endpoint and report exactly what each one said.
 *
 * This exists because the loop it replaces was expensive: a shape mismatch
 * surfaced as a user-facing refusal, which took a round trip to describe, a
 * round trip to guess at, and another to verify. One probe carries the status,
 * the byte count, the first of the body and what the parser made of it — so a
 * wrong assumption is corrected once, from evidence.
 */
export async function probeToken(
  token: string,
  opts: SourceOptions = {},
): Promise<ProbeReport> {
  const endpoints = (opts.endpoints ?? ENDPOINTS).filter((endpoint) => endpoint.pairs);
  const attempts = await Promise.all(
    endpoints.map((endpoint) => attempt(endpoint.name, fill(endpoint.pairs!, { token }), opts)),
  );
  const [best] = byLiquidity(attempts.flatMap((result) => result.pairs));
  return {
    token,
    attempts,
    best: best ?? null,
    allRefused: attempts.length > 0 && attempts.every((result) => result.refused),
  };
}

/**
 * A quote source over the endpoint list.
 *
 * Tries each in order and takes the first that yields anything, so one
 * provider being down, rate-limiting, or simply not covering a chain degrades
 * to the next rather than to a failure.
 */
export function aggregatorSource(opts: SourceOptions = {}): QuoteSource {
  const endpoints = opts.endpoints ?? ENDPOINTS;

  return {
    name: 'aggregator',

    async pairsFor(token: string): Promise<PairQuote[]> {
      for (const endpoint of endpoints) {
        if (!endpoint.pairs) continue;
        const result = await attempt(endpoint.name, fill(endpoint.pairs, { token }), opts);
        if (result.pairs.length > 0) return result.pairs;
      }
      return [];
    },

    async bars(pair: PairQuote, barOpts: { limit?: number; minutes?: number } = {}): Promise<Bar[]> {
      const minutes = barOpts.minutes ?? 5;
      for (const endpoint of endpoints) {
        if (!endpoint.bars) continue;
        const url = fill(endpoint.bars, {
          chain: pair.chain,
          pair: pair.pairId,
          timeframe: endpoint.timeframe ? endpoint.timeframe(minutes) : String(minutes),
        });
        const result = await attempt(endpoint.name, url, opts);
        if (result.bars.length > 0) {
          return barOpts.limit ? result.bars.slice(-barOpts.limit) : result.bars;
        }
      }
      return [];
    },
  };
}
