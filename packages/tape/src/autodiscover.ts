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
/** fee() — present on concentrated-liquidity pools, absent on V2 pairs */
const FEE = '0xddca3f43';

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
  // The lookarounds are load-bearing. Without them a 64-character pool id
  // matches its own first 40 characters and becomes a plausible-looking
  // address that was never deployed, which then fails verification for a
  // reason that has nothing to do with why it failed.
  for (const match of text.matchAll(/(?<![0-9a-fA-F])0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g)) {
    const address = match[0].toLowerCase();
    if (!skip.has(address) && address !== `0x${'0'.repeat(40)}`) found.add(address);
  }
  return [...found] as Address[];
}

/**
 * 32-byte identifiers in the same text.
 *
 * A venue that names pools with a hash rather than an address is not a
 * constant-product pair and never will be: Uniswap V4 holds every pool inside
 * one singleton and identifies them by `PoolId`, so there is no per-pair
 * contract to call `token0()` on. Spotting these is the difference between
 * "none of these were pairs" and "this token trades somewhere this code does
 * not support yet", which are very different things to tell someone.
 */
export function poolIdsIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?<![0-9a-fA-F])0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/g)) {
    found.add(match[0].toLowerCase());
  }
  return [...found];
}

/** Best-effort hints from an indexer. Never throws; an outage yields nothing. */
export interface Hints {
  pools: Address[];
  /** 32-byte ids, which imply a venue with no per-pair contract. */
  poolIds: string[];
}

export async function hintsFrom(
  url: string,
  token: Address,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Hints> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const response = await doFetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 6_000),
    });
    if (!response.ok) return { pools: [], poolIds: [] };
    const text = await response.text();
    return { pools: addressesIn(text, [token]), poolIds: poolIdsIn(text) };
  } catch {
    return { pools: [], poolIds: [] };
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
    // A concentrated-liquidity pool answers token0/token1 exactly like a pair
    // and then has no reserves at all — liquidity lives in ticks. Saying
    // "reserves unreadable" for that hides a whole category of venue behind
    // what sounds like a transient read failure.
    const concentrated = await call(pool, encodeCall(FEE)).then(
      () => true,
      () => false,
    );
    return {
      pool,
      rejected: concentrated
        ? 'concentrated-liquidity pool (Uniswap V3 style), which this runner cannot price yet'
        : 'reserves unreadable',
    };
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
    /** 32-byte pool ids seen alongside the candidates, if any. */
    poolIds?: string[];
    venue?: string;
    /** Cap on chain round trips; each candidate costs about five calls. */
    maxCandidates?: number;
  },
): Promise<AutoDiscovery> {
  const poolIds = request.poolIds ?? [];
  const unsupported =
    poolIds.length > 0
      ? `this token appears to trade on a venue that identifies pools by a 32-byte id rather than a pair contract (Uniswap V4 and similar), which this runner cannot read yet`
      : null;

  // Ask the chain about the token first. "No pools found" for an address that
  // is not even deployed here sends someone hunting for liquidity when the
  // real answer is that they are pointed at the wrong chain.
  const base = await readAsset(call, request.chainId, request.token).catch(() => null);
  if (!base) {
    return {
      market: null,
      candidates: [],
      note: 'that address does not answer decimals() on this chain, so it is not a token here — check which chain it was deployed on',
    };
  }

  const pools = request.candidates.slice(0, request.maxCandidates ?? 12);
  if (pools.length === 0) {
    return {
      market: null,
      candidates: [],
      note: unsupported ?? `${base.symbol} is a token here, but no candidate pools turned up to check`,
    };
  }

  const candidates: Candidate[] = [];
  for (const pool of pools) {
    candidates.push(await inspect(call, request.chainId, pool, request.token));
  }

  const verified = candidates.filter((candidate) => candidate.rejected === null);
  if (verified.length === 0) {
    const checked = `checked ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}; none held ${base.symbol} with liquidity`;
    return {
      market: null,
      candidates,
      // When every candidate failed AND the hints carried 32-byte ids, the
      // venue is the explanation, not the addresses.
      note: unsupported ? `${checked}. Likely because ${unsupported}.` : checked,
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

/** base58, 32-44 chars, and the alphabet omits 0 O I l. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function assertAddress(input: string): Address {
  const raw = input.trim();
  const trimmed = raw.toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(trimmed)) return trimmed as Address;

  // Naming the format is the difference between a dead end and a decision.
  // Most memecoin flow is on Solana, so this is the likeliest paste to fail,
  // and "not a contract address" tells someone nothing about why.
  if (BASE58.test(raw) && !raw.startsWith('0x')) {
    throw new TapeError(
      `"${raw}" looks like a Solana address. This runner reads EVM chains only — ` +
        'ERC-20 tokens and constant-product pairs. Solana needs a different feed.',
    );
  }
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new TapeError(
      `"${raw}" is 32 bytes, which is a pool id or a transaction hash rather than a token address.`,
    );
  }
  if (/^0x[0-9a-fA-F]*$/.test(raw)) {
    const digits = raw.length - 2;
    throw new TapeError(
      `"${raw}" has ${digits} hex digit${digits === 1 ? '' : 's'}; an address has 40.`,
    );
  }
  throw new TapeError(`"${raw}" is not a contract address`);
}

/**
 * A token identifier for the aggregator path.
 *
 * Accepts an EVM address or a base58 mint, because "which chain family" is
 * not a question the person pasting a ticker should have to answer. The chain
 * runner still uses `assertAddress`, which is stricter for good reason: it is
 * about to make an eth_call.
 */
export function assertTokenId(input: string): string {
  const raw = input.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) return raw.toLowerCase();
  if (BASE58.test(raw) && !raw.startsWith('0x')) return raw;
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new TapeError(
      `"${raw}" is 32 bytes, which is a pool id or a transaction hash rather than a token.`,
    );
  }
  throw new TapeError(`"${raw}" is neither an EVM address nor a base58 mint.`);
}
