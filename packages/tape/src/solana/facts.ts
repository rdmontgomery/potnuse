import { decodeMint, fromBase64, type MintAccount } from './mint.ts';

/**
 * What a Solana RPC can tell us about a token before any capital moves.
 *
 * The aggregator that prices a pair knows nothing about its authorities, and
 * those are the facts that decide whether a position can be diluted or
 * stranded. They are also cheap: two calls, no indexer, no API key.
 */
export interface SolanaTokenFacts {
  /** True when supply can still be minted — your share is not a fixed share. */
  canMint: boolean | null;
  /** True when accounts can be frozen — you can hold and be unable to sell. */
  canFreeze: boolean | null;
  supply: bigint | null;
  decimals: number | null;
  /** Largest holder outside the pool, as a percent of supply. */
  topHolderPct: number | null;
  /** What was tried and what came back, for the screen to quote. */
  notes: string[];
}

type Rpc = (method: string, params: unknown[]) => Promise<unknown>;

/** Solana's own public endpoint: no key, rate-limited, fine at this volume. */
export const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

export function solanaRpc(url: string, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Rpc {
  const doFetch = opts.fetchImpl ?? fetch;
  let id = 0;
  return async (method, params) => {
    const response = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: (id += 1), method, params }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
    });
    if (!response.ok) throw new Error(`rpc ${response.status}`);
    const body = (await response.json()) as { result?: unknown; error?: { message: string } };
    if (body.error) throw new Error(body.error.message);
    return body.result;
  };
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

/** Pull the base64 account data out of a getAccountInfo result. */
export function accountData(result: unknown): Uint8Array | null {
  const value = asRecord(asRecord(result)?.value);
  const data = value?.data;
  const encoded = Array.isArray(data) ? data[0] : data;
  if (typeof encoded !== 'string' || encoded === '') return null;
  try {
    return fromBase64(encoded);
  } catch {
    return null;
  }
}

/** Amounts from getTokenLargestAccounts, largest first. */
export function largestAmounts(result: unknown): bigint[] {
  const value = asRecord(result)?.value;
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const amount = asRecord(entry)?.amount;
      try {
        return typeof amount === 'string' ? BigInt(amount) : null;
      } catch {
        return null;
      }
    })
    .filter((amount): amount is bigint => amount !== null && amount > 0n)
    .sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
}

/**
 * Holder concentration, discounting the pool.
 *
 * The largest token account for any traded token is almost always the AMM's
 * own vault, and counting that as a whale would flag every healthy market.
 *
 * So exactly ONE account is discounted: the single one closest to the pool's
 * estimated size. Excluding a whole band around that size instead would
 * swallow a genuine whale who happens to hold about as much as the pool —
 * which on a memecoin is not a rare accident but a common one, and precisely
 * the holder worth knowing about.
 *
 * Without a pool estimate the largest account is dropped on the same
 * assumption. That is stated rather than hidden, because it is occasionally
 * wrong.
 */
export function topHolderShare(
  amounts: bigint[],
  supply: bigint,
  poolBaseUnits: bigint | null,
): { pct: number | null; note: string } {
  if (supply <= 0n || amounts.length === 0) return { pct: null, note: 'no holder data' };

  const pct = (amount: bigint) => Number((amount * 10_000n) / supply) / 100;

  if (poolBaseUnits !== null && poolBaseUnits > 0n) {
    const distance = (amount: bigint) =>
      amount > poolBaseUnits ? amount - poolBaseUnits : poolBaseUnits - amount;
    let poolIndex = 0;
    for (let i = 1; i < amounts.length; i += 1) {
      if (distance(amounts[i]!) < distance(amounts[poolIndex]!)) poolIndex = i;
    }
    const rest = amounts.filter((_, index) => index !== poolIndex);
    const largest = rest[0];
    return largest === undefined
      ? { pct: null, note: 'only the pool holds this token' }
      : { pct: pct(largest), note: 'largest holder outside the pool' };
  }

  const second = amounts[1];
  return second === undefined
    ? { pct: null, note: 'only one large account, assumed to be the pool' }
    : { pct: pct(second), note: 'second largest, assuming the largest is the pool' };
}

/**
 * Read a mint's authorities and concentration.
 *
 * Never throws: a fact that could not be established comes back null, which
 * the screen already treats as a warning rather than as clear. Failing loudly
 * here would turn a degraded price source into a refusal to look at a token
 * at all.
 */
export async function solanaTokenFacts(
  rpc: Rpc,
  mint: string,
  opts: { poolBaseUsd?: number | null; priceUsd?: number | null } = {},
): Promise<SolanaTokenFacts> {
  const facts: SolanaTokenFacts = {
    canMint: null,
    canFreeze: null,
    supply: null,
    decimals: null,
    topHolderPct: null,
    notes: [],
  };

  let account: MintAccount | null = null;
  try {
    const bytes = accountData(await rpc('getAccountInfo', [mint, { encoding: 'base64' }]));
    account = bytes ? decodeMint(bytes) : null;
    if (!account) facts.notes.push('mint account did not decode as an SPL mint');
  } catch (error) {
    facts.notes.push(`mint read failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (account) {
    facts.canMint = account.mintAuthority !== null;
    facts.canFreeze = account.freezeAuthority !== null;
    facts.supply = account.supply;
    facts.decimals = account.decimals;
    facts.notes.push(
      account.mintAuthority === null ? 'mint authority revoked' : `mint authority live: ${account.mintAuthority}`,
      account.freezeAuthority === null ? 'freeze authority revoked' : `freeze authority live: ${account.freezeAuthority}`,
    );
  }

  if (account && account.supply > 0n) {
    try {
      // Pool size in base units needs the mint's decimals, which is why this
      // is computed here rather than handed in.
      const poolBaseUnits =
        opts.poolBaseUsd && opts.priceUsd && opts.priceUsd > 0
          ? BigInt(Math.round((opts.poolBaseUsd / opts.priceUsd) * 10 ** account.decimals))
          : null;
      const amounts = largestAmounts(await rpc('getTokenLargestAccounts', [mint]));
      const share = topHolderShare(amounts, account.supply, poolBaseUnits);
      facts.topHolderPct = share.pct;
      facts.notes.push(share.note);
    } catch (error) {
      facts.notes.push(
        `holder read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return facts;
}
