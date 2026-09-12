import { readAsset } from './discover.ts';
import { encodeCall, wordToAddress, words } from './feed/rpc.ts';
import type { EthCall } from './feed/types.ts';
import { TapeError, type Address, type Asset, type Market } from './types.ts';

/** token0() */
const TOKEN0 = '0x0dfe1683';
/** token1() */
const TOKEN1 = '0xd21220a7';
/** getReserves() */
const GET_RESERVES = '0x0902f1ac';

export interface Candidate {
  pool: Address;
  /** Why this pool was rejected, or null if it verified. */
  rejected: string | null;
  quote?: Asset;
  /** Quote-side reserve, decimal-normalised. Only comparable within a quote asset. */
  quoteDepth?: number;
}

export interface AutoDiscovery {
  market: Market | null;
  candidates: Candidate[];
  note: string;
}

/**
 * Pull candidate pool addresses out of arbitrary JSON.
 *
 * Deliberately shape-agnostic: it walks the text for anything that looks like
 * an address rather than reaching into a documented structure. Every candidate
 * is verified against the chain afterwards, so a hint source that changes its
 * response, returns nonsense, or is replaced entirely costs nothing — bad
 * candidates simply fail to verify. The indexer points; the chain decides.
 */
export function addressesIn(text: string, exclude: Address[] = []): Address[] {
  const skip = new Set(exclude.map((address) => address.toLowerCase()));
  const found = new Set<string>();
  for (const match of text.matchAll(/0x[0-9a-fA-F]{40}/g)) {
    const address = match[0].toLowerCase();
    if (!skip.has(address) && address !== `0x${'0'.repeat(40)}`) found.add(address);
  }
  return [...found] as Address[];
}

/** Best-effort hints from an indexer. Never throws; an outage yields nothing. */
export async function hintsFrom(
  url: string,
  token: Address,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Address[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const response = await doFetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 6_000),
    });
    if (!response.ok) return [];
    return addressesIn(await response.text(), [token]);
  } catch {
    return [];
  }
}

async function inspect(
  call: EthCall,
  chainId: number,
  pool: Address,
  token: Address,
): Promise<Candidate> {
  const lower = token.toLowerCase();
  let token0: Address;
  let token1: Address;

  try {
    [token0, token1] = await Promise.all([
      call(pool, encodeCall(TOKEN0)).then((r) => wordToAddress(words(r)[0])),
      call(pool, encodeCall(TOKEN1)).then((r) => wordToAddress(words(r)[0])),
    ]);
  } catch {
    return { pool, rejected: 'not a constant-product pair' };
  }

  const baseIsToken0 = token0.toLowerCase() === lower;
  if (!baseIsToken0 && token1.toLowerCase() !== lower) {
    return { pool, rejected: 'pair does not hold this token' };
  }

  const quoteAddress = baseIsToken0 ? token1 : token0;
  let reserves: string[];
  try {
    reserves = words(await call(pool, encodeCall(GET_RESERVES)));
  } catch {
    return { pool, rejected: 'reserves unreadable' };
  }

  const raw = BigInt(`0x${baseIsToken0 ? reserves[1] : reserves[0]}`);
  if (raw <= 0n) return { pool, rejected: 'no liquidity on the quote side' };

  let quote: Asset;
  try {
    quote = await readAsset(call, chainId, quoteAddress);
  } catch {
    return { pool, rejected: 'quote side is not a readable token' };
  }

  return {
    pool,
    rejected: null,
    quote,
    quoteDepth: Number(raw) / 10 ** quote.decimals,
  };
}

/**
 * Find the pool for a token given nothing but its address.
 *
 * The point is that a contract address is all anyone actually has. Pool,
 * quote asset, decimals and symbols are all on-chain facts, and asking a
 * person to look them up is asking them to do a machine's job badly.
 *
 * Candidates may come from anywhere — an indexer, a factory lookup, a guess.
 * None of them are trusted: each is checked against the chain for holding this
 * token and having liquidity, and only survivors are ranked.
 *
 * Ranking is by quote-side depth, which is only strictly comparable between
 * pools sharing a quote asset. Across different quotes it is a heuristic, so
 * every candidate is returned alongside the winner rather than hidden.
 */
export async function autoDiscover(
  call: EthCall,
  request: {
    chainId: number;
    token: Address;
    candidates: Address[];
    venue?: string;
    /** Cap on chain round trips; each candidate costs about five calls. */
    maxCandidates?: number;
  },
): Promise<AutoDiscovery> {
  const pools = request.candidates.slice(0, request.maxCandidates ?? 12);
  if (pools.length === 0) {
    return { market: null, candidates: [], note: 'no candidate pools to check' };
  }

  const base = await readAsset(call, request.chainId, request.token).catch(() => null);
  if (!base) {
    return {
      market: null,
      candidates: [],
      note: 'that address does not answer decimals(), so it is not an ERC-20 on this chain',
    };
  }

  const candidates: Candidate[] = [];
  for (const pool of pools) {
    candidates.push(await inspect(call, request.chainId, pool, request.token));
  }

  const verified = candidates.filter((candidate) => candidate.rejected === null);
  if (verified.length === 0) {
    return {
      market: null,
      candidates,
      note: `checked ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}; none held ${base.symbol} with liquidity`,
    };
  }

  verified.sort((a, b) => (b.quoteDepth ?? 0) - (a.quoteDepth ?? 0));
  const best = verified[0]!;

  return {
    market: {
      base,
      quote: best.quote!,
      pool: best.pool,
      venue: request.venue ?? 'uniswap-v2',
    },
    candidates,
    note:
      verified.length === 1
        ? `one pool holds ${base.symbol}`
        : `${verified.length} pools hold ${base.symbol}; took the deepest (${best.quote!.symbol})`,
  };
}

export function assertAddress(input: string): Address {
  const trimmed = input.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(trimmed)) {
    throw new TapeError(`"${input.trim()}" is not a contract address`);
  }
  return trimmed as Address;
}
