import { describe, expect, it } from 'vitest';
import { addressesIn, assertAddress, autoDiscover, hintsFrom } from './autodiscover.ts';
import type { EthCall } from './feed/types.ts';
import type { Address } from './types.ts';

const TOKEN: Address = '0x00000000000000000000000000000000000000aa';
const USDC: Address = '0x00000000000000000000000000000000000000bb';
const WETH: Address = '0x00000000000000000000000000000000000000cc';
const POOL_USDC: Address = '0x0000000000000000000000000000000000000d01';
const POOL_WETH: Address = '0x0000000000000000000000000000000000000d02';
const NOT_A_PAIR: Address = '0x0000000000000000000000000000000000000d03';
const EMPTY_POOL: Address = '0x0000000000000000000000000000000000000d04';

const word = (v: string | bigint) =>
  (typeof v === 'bigint' ? v.toString(16) : v.replace(/^0x/, '')).padStart(64, '0');
const hexOf = (t: string) => [...t].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
const symbolOf = (t: string) => `0x${word(32n)}${word(BigInt(t.length))}${hexOf(t).padEnd(64, '0')}`;

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;

/** A chain with two real pools, one decoy contract and one drained pool. */
function chain(): EthCall {
  const tokens: Record<string, { decimals: bigint; symbol: string }> = {
    [TOKEN]: { decimals: 18n, symbol: 'MEME' },
    [USDC]: { decimals: 6n, symbol: 'USDC' },
    [WETH]: { decimals: 18n, symbol: 'WETH' },
  };
  const pairs: Record<string, { t0: Address; t1: Address; r0: bigint; r1: bigint }> = {
    // MEME/USDC is much deeper once decimals are accounted for.
    [POOL_USDC]: { t0: TOKEN, t1: USDC, r0: 1_000_000n * E18, r1: 250_000n * E6 },
    [POOL_WETH]: { t0: WETH, t1: TOKEN, r0: 40n * E18, r1: 900_000n * E18 },
    [EMPTY_POOL]: { t0: TOKEN, t1: USDC, r0: 1n * E18, r1: 0n },
  };

  return async (to, data) => {
    const selector = data.slice(0, 10);
    const address = to.toLowerCase();
    const token = tokens[address];
    if (token) {
      if (selector === '0x313ce567') return `0x${word(token.decimals)}` as `0x${string}`;
      if (selector === '0x95d89b41') return symbolOf(token.symbol) as `0x${string}`;
    }
    const pair = pairs[address];
    if (pair) {
      if (selector === '0x0dfe1683') return `0x${word(pair.t0)}` as `0x${string}`;
      if (selector === '0xd21220a7') return `0x${word(pair.t1)}` as `0x${string}`;
      if (selector === '0x0902f1ac') {
        return `0x${word(pair.r0)}${word(pair.r1)}${word(1n)}` as `0x${string}`;
      }
    }
    throw new Error(`reverted: ${address} ${selector}`);
  };
}

const discover = (candidates: Address[]) =>
  autoDiscover(chain(), { chainId: 4663, token: TOKEN, candidates });

describe('address scraping', () => {
  it('pulls addresses out of arbitrary JSON without knowing its shape', () => {
    // The point: an indexer can change its response and this keeps working.
    const blob = `{"data":[{"id":"robinhood_${POOL_USDC}","attributes":{"address":"${POOL_WETH}"}}]}`;
    expect(addressesIn(blob).sort()).toEqual([POOL_USDC, POOL_WETH].sort());
  });

  it('excludes the token being searched for', () => {
    expect(addressesIn(`${TOKEN} ${POOL_USDC}`, [TOKEN])).toEqual([POOL_USDC]);
  });

  it('drops the zero address and deduplicates', () => {
    const zero = `0x${'0'.repeat(40)}`;
    expect(addressesIn(`${zero} ${POOL_USDC} ${POOL_USDC.toUpperCase()}`)).toEqual([POOL_USDC]);
  });

  it('finds nothing in text with no addresses', () => {
    expect(addressesIn('{"error":"not found"}')).toEqual([]);
  });
});

describe('hints are never trusted and never fatal', () => {
  it('returns addresses from a successful fetch', async () => {
    const fetchImpl = (async () =>
      new Response(`{"pool":"${POOL_USDC}"}`, { status: 200 })) as unknown as typeof fetch;
    expect(await hintsFrom('https://x.invalid', TOKEN, { fetchImpl })).toEqual([POOL_USDC]);
  });

  it('yields nothing rather than throwing when the indexer is down', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await hintsFrom('https://x.invalid', TOKEN, { fetchImpl })).toEqual([]);
  });

  it('yields nothing on a non-200', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    expect(await hintsFrom('https://x.invalid', TOKEN, { fetchImpl })).toEqual([]);
  });
});

describe('discovery verifies every candidate against the chain', () => {
  it('resolves a market from a single correct hint', async () => {
    const result = await discover([POOL_USDC]);
    expect(result.market?.pool).toBe(POOL_USDC);
    expect(result.market?.base.symbol).toBe('MEME');
    expect(result.market?.quote.symbol).toBe('USDC');
    expect(result.market?.quote.decimals).toBe(6);
  });

  it('handles the token being token1 as readily as token0', async () => {
    const result = await discover([POOL_WETH]);
    expect(result.market?.quote.symbol).toBe('WETH');
  });

  it('rejects a contract that is not a pair, without failing the search', async () => {
    const result = await discover([NOT_A_PAIR, POOL_USDC]);
    expect(result.market?.pool).toBe(POOL_USDC);
    expect(result.candidates.find((c) => c.pool === NOT_A_PAIR)?.rejected).toMatch(/not a/);
  });

  it('rejects a drained pool', async () => {
    const result = await discover([EMPTY_POOL]);
    expect(result.market).toBeNull();
    expect(result.candidates[0]?.rejected).toMatch(/no liquidity/);
  });

  it('takes the deepest pool and says which, reporting the rest', async () => {
    const result = await discover([POOL_WETH, POOL_USDC]);
    expect(result.market?.pool).toBe(POOL_USDC);
    expect(result.note).toMatch(/took the deepest \(USDC\)/);
    expect(result.candidates.filter((c) => c.rejected === null)).toHaveLength(2);
  });

  it('survives a hint list that is entirely garbage', async () => {
    // The whole safety argument: a wrong indexer costs nothing.
    const result = await discover([NOT_A_PAIR, EMPTY_POOL]);
    expect(result.market).toBeNull();
    expect(result.note).toMatch(/none held MEME with liquidity/);
  });

  it('says plainly when the address is not a token on this chain', async () => {
    const result = await autoDiscover(chain(), {
      chainId: 4663,
      token: POOL_USDC,
      candidates: [POOL_USDC],
    });
    expect(result.market).toBeNull();
    expect(result.note).toMatch(/not an ERC-20 on this chain/);
  });

  it('reports having nothing to check rather than pretending to search', async () => {
    expect((await discover([])).note).toMatch(/no candidate pools/);
  });

  it('bounds how many candidates it will check', async () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      `0x${(i + 1).toString(16).padStart(40, '0')}`,
    ) as Address[];
    const result = await autoDiscover(chain(), {
      chainId: 4663,
      token: TOKEN,
      candidates: many,
      maxCandidates: 5,
    });
    expect(result.candidates).toHaveLength(5);
  });
});

describe('address validation', () => {
  it('normalises a pasted address', () => {
    expect(assertAddress(`  ${POOL_USDC.toUpperCase().replace('0X', '0x')}  `)).toBe(POOL_USDC);
  });

  it('rejects anything that is not one, with the input quoted back', () => {
    expect(() => assertAddress('artificial inu')).toThrow(/"artificial inu" is not a contract/);
    expect(() => assertAddress('0x123')).toThrow(/not a contract address/);
  });
});
