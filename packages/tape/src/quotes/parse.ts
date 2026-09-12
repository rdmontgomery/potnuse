import type { Bar, PairQuote } from './types.ts';

/**
 * Lenient extraction of pair data from an aggregator response.
 *
 * Written as a tolerant walk rather than a typed parser against a documented
 * schema, for a reason worth stating: this code is authored where the real
 * responses cannot be observed, and a parser built on a guessed shape fails
 * silently and confidently. A walk that looks for recognisable fields under
 * any of their common spellings either finds a pair or plainly does not, and
 * survives an API adding, renaming or nesting things.
 *
 * Whatever it extracts is treated as a hint. Nothing here is trusted enough to
 * trade on without the screen and the fill model having their say.
 */

type Json = unknown;

const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read the first key that exists, following dotted paths. */
function pick(source: Record<string, Json>, keys: string[]): Json {
  for (const key of keys) {
    let cursor: Json = source;
    let ok = true;
    for (const segment of key.split('.')) {
      if (!isObject(cursor) || !(segment in cursor)) {
        ok = false;
        break;
      }
      cursor = cursor[segment];
    }
    if (ok && cursor !== null && cursor !== undefined) return cursor;
  }
  return undefined;
}

function asNumber(value: Json): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: Json): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

const PAIR_ID = ['pairAddress', 'pair_address', 'poolAddress', 'pool_address', 'address', 'id'];
const CHAIN = ['chainId', 'chain_id', 'chain', 'network', 'networkId', 'relationships.network.data.id'];
const DEX = ['dexId', 'dex_id', 'dex', 'relationships.dex.data.id', 'exchange'];
const PRICE_USD = ['priceUsd', 'price_usd', 'base_token_price_usd', 'attributes.base_token_price_usd'];
const PRICE_NATIVE = ['priceNative', 'price_native', 'base_token_price_native_currency'];
const LIQUIDITY = ['liquidity.usd', 'liquidity_usd', 'reserve_in_usd', 'totalLiquidityUsd'];
const VOLUME = ['volume.h24', 'volume_usd.h24', 'volume24h', 'volume_usd_24h'];
const BASE_SYMBOL = ['baseToken.symbol', 'base_token.symbol', 'base_symbol'];
const BASE_ADDRESS = ['baseToken.address', 'base_token.address', 'base_token_address'];
const QUOTE_SYMBOL = ['quoteToken.symbol', 'quote_token.symbol', 'quote_symbol'];
const QUOTE_ADDRESS = ['quoteToken.address', 'quote_token.address', 'quote_token_address'];

/**
 * Some sources put both symbols in one name field: "AI / NVDAx".
 * Only used when the structured fields are absent.
 */
function splitName(name: string | null): { base: string | null; quote: string | null } {
  if (!name) return { base: null, quote: null };
  const parts = name.split(/\s*[/⁄]\s*/);
  return parts.length === 2
    ? { base: parts[0]!.trim() || null, quote: parts[1]!.trim() || null }
    : { base: null, quote: null };
}

/** Strip an aggregator's chain prefix: "solana_ABC…" → "ABC…". */
function bareId(id: string, chain: string | null): string {
  if (chain && id.toLowerCase().startsWith(`${chain.toLowerCase()}_`)) {
    return id.slice(chain.length + 1);
  }
  return id;
}

function toPair(node: Record<string, Json>): PairQuote | null {
  // Attribute-style payloads nest everything one level down; merge so the
  // field lookups below work on either shape.
  const attributes = pick(node, ['attributes']);
  const flat: Record<string, Json> = isObject(attributes) ? { ...node, ...attributes } : node;

  const priceUsd = asNumber(pick(flat, PRICE_USD));
  const liquidityUsd = asNumber(pick(flat, LIQUIDITY));
  // A pair we cannot price and cannot size is not usable, whatever else it has.
  if (priceUsd === null && liquidityUsd === null) return null;

  const rawId = asString(pick(flat, PAIR_ID));
  if (!rawId) return null;

  const chainRaw = pick(flat, CHAIN);
  const chain = asString(chainRaw) ?? (asNumber(chainRaw) !== null ? String(asNumber(chainRaw)) : null);

  const named = splitName(asString(pick(flat, ['name'])));

  return {
    chain: chain ?? 'unknown',
    pairId: bareId(rawId, chain),
    dex: asString(pick(flat, DEX)),
    baseSymbol: asString(pick(flat, BASE_SYMBOL)) ?? named.base,
    baseAddress: asString(pick(flat, BASE_ADDRESS)),
    quoteSymbol: asString(pick(flat, QUOTE_SYMBOL)) ?? named.quote,
    quoteAddress: asString(pick(flat, QUOTE_ADDRESS)),
    priceUsd,
    priceNative: asNumber(pick(flat, PRICE_NATIVE)),
    liquidityUsd,
    volume24hUsd: asNumber(pick(flat, VOLUME)),
  };
}

/** Walk any JSON and pull out every pair-shaped object, deepest last. */
export function pairsIn(payload: Json, limit = 50): PairQuote[] {
  const found: PairQuote[] = [];
  const seen = new Set<string>();

  const visit = (node: Json, depth: number): void => {
    if (found.length >= limit || depth > 8) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (!isObject(node)) return;

    const pair = toPair(node);
    if (pair) {
      const key = `${pair.chain}:${pair.pairId}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        found.push(pair);
      }
    }
    for (const value of Object.values(node)) visit(value, depth + 1);
  };

  visit(payload, 0);
  return found;
}

/** Deepest liquidity first; a pair with no depth figure sorts last. */
export function byLiquidity(pairs: PairQuote[]): PairQuote[] {
  return [...pairs].sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
}

/**
 * OHLCV rows, as either arrays or objects.
 *
 * The array form `[t, o, h, l, c, v]` is near-universal. Timestamps arrive in
 * seconds or milliseconds depending on the source, so they are normalised by
 * magnitude rather than by trusting a documented unit.
 */
export function barsIn(payload: Json, limit = 1000): Bar[] {
  const bars: Bar[] = [];

  const toMillis = (value: number) => (value > 1e11 ? value : value * 1000);

  const fromArray = (row: Json): Bar | null => {
    if (!Array.isArray(row) || row.length < 5) return null;
    const [t, open, high, low, close, volume] = row.slice(0, 6).map(asNumber);
    if (
      t === null || t === undefined ||
      open === null || open === undefined ||
      high === null || high === undefined ||
      low === null || low === undefined ||
      close === null || close === undefined
    ) {
      return null;
    }
    return { t: toMillis(t), open, high, low, close, volume: volume ?? null };
  };

  const fromObject = (row: Json): Bar | null => {
    if (!isObject(row)) return null;
    const t = asNumber(pick(row, ['t', 'time', 'timestamp', 'ts', 'openTime']));
    const open = asNumber(pick(row, ['o', 'open']));
    const high = asNumber(pick(row, ['h', 'high']));
    const low = asNumber(pick(row, ['l', 'low']));
    const close = asNumber(pick(row, ['c', 'close']));
    if (t === null || open === null || high === null || low === null || close === null) return null;
    return {
      t: toMillis(t),
      open,
      high,
      low,
      close,
      volume: asNumber(pick(row, ['v', 'volume'])),
    };
  };

  const visit = (node: Json, depth: number): void => {
    if (bars.length >= limit || depth > 8) return;
    if (Array.isArray(node)) {
      const rows = node.map((row) => fromArray(row) ?? fromObject(row));
      if (rows.length > 0 && rows.every((row) => row !== null)) {
        bars.push(...(rows as Bar[]));
        return;
      }
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (isObject(node)) for (const value of Object.values(node)) visit(value, depth + 1);
  };

  visit(payload, 0);
  // Sources disagree on direction; the ladder needs oldest first.
  return bars.sort((a, b) => a.t - b.t).slice(0, limit);
}
