import { describe, expect, it } from 'vitest';
import { decodeSymbol, discoverMarket, findPair, readAsset } from './discover.ts';
import type { EthCall } from './feed/types.ts';
import type { Address } from './types.ts';

const BASE: Address = '0x00000000000000000000000000000000000000aa';
const QUOTE: Address = '0x00000000000000000000000000000000000000bb';
const POOL: Address = '0x00000000000000000000000000000000000000cc';
const FACTORY: Address = '0x00000000000000000000000000000000000000ff';

const word = (v: string | bigint) =>
  (typeof v === 'bigint' ? v.toString(16) : v.replace(/^0x/, '')).padStart(64, '0');

const hexOf = (text: string) =>
  [...text].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

/** A proper dynamic-string symbol() return. */
const dynamicSymbol = (text: string) =>
  `0x${word(32n)}${word(BigInt(text.length))}${hexOf(text).padEnd(64, '0')}`;

/** The old bytes32 form some tokens still use. */
const bytes32Symbol = (text: string) => `0x${hexOf(text).padEnd(64, '0')}`;

function node(handlers: Record<string, Record<string, string>>): EthCall {
  return async (to, data) => {
    const selector = data.slice(0, 10);
    const answer = handlers[to.toLowerCase()]?.[selector];
    if (answer === undefined) throw new Error(`no stub for ${to} ${selector}`);
    return answer as `0x${string}`;
  };
}

const tokens = {
  [BASE]: { '0x313ce567': `0x${word(18n)}`, '0x95d89b41': dynamicSymbol('MEME') },
  [QUOTE]: { '0x313ce567': `0x${word(6n)}`, '0x95d89b41': dynamicSymbol('USDC') },
};

describe('symbol decoding', () => {
  it('reads a dynamic string', () => {
    expect(decodeSymbol(dynamicSymbol('MEME'))).toBe('MEME');
  });

  it('reads the old bytes32 form', () => {
    // Guessing wrong here yields mojibake on tokens that are otherwise fine.
    expect(decodeSymbol(bytes32Symbol('MKR'))).toBe('MKR');
  });

  it('falls back rather than throwing on empty returndata', () => {
    expect(decodeSymbol('0x')).toBe('???');
  });

  it('does not mistake a long symbol for an offset', () => {
    expect(decodeSymbol(dynamicSymbol('ARTIFICIALINU'))).toBe('ARTIFICIALINU');
  });
});

describe('asset metadata', () => {
  it('reads decimals and symbol together', async () => {
    expect(await readAsset(node(tokens), 4663, BASE)).toEqual({
      chainId: 4663,
      address: BASE,
      symbol: 'MEME',
      decimals: 18,
    });
  });

  it('keeps going when symbol() reverts', async () => {
    const call = node({ [BASE]: { '0x313ce567': `0x${word(18n)}` } });
    expect((await readAsset(call, 4663, BASE)).symbol).toBe('???');
  });

  it('refuses an address whose decimals are not plausible', async () => {
    // A contract that is not a token answers this call with something absurd,
    // and a bad decimals value misprices by orders of magnitude while looking
    // entirely reasonable on screen.
    const call = node({ [BASE]: { '0x313ce567': `0x${word(255n)}` } });
    await expect(readAsset(call, 4663, BASE)).rejects.toThrow(/not a token/);
  });
});

describe('pool lookup', () => {
  it('finds the pair through the factory', async () => {
    const call = node({ [FACTORY]: { '0xe6a43905': `0x${word(POOL)}` } });
    expect(await findPair(call, FACTORY, BASE, QUOTE)).toBe(POOL);
  });

  it('reports no pair rather than returning the zero address', async () => {
    const call = node({ [FACTORY]: { '0xe6a43905': `0x${word(0n)}` } });
    expect(await findPair(call, FACTORY, BASE, QUOTE)).toBeNull();
  });
});

describe('discovery', () => {
  it('builds a market from a factory lookup', async () => {
    const call = node({ ...tokens, [FACTORY]: { '0xe6a43905': `0x${word(POOL)}` } });
    const market = await discoverMarket(call, {
      chainId: 4663,
      base: BASE,
      quote: QUOTE,
      factory: FACTORY,
    });
    expect(market.pool).toBe(POOL);
    expect(market.base.decimals).toBe(18);
    expect(market.quote.decimals).toBe(6);
    expect(market.base.symbol).toBe('MEME');
  });

  it('accepts a pool address directly, skipping the factory', async () => {
    const market = await discoverMarket(node(tokens), {
      chainId: 4663,
      base: BASE,
      quote: QUOTE,
      pool: POOL,
    });
    expect(market.pool).toBe(POOL);
  });

  it('says so when the pair does not exist', async () => {
    const call = node({ ...tokens, [FACTORY]: { '0xe6a43905': `0x${word(0n)}` } });
    await expect(
      discoverMarket(call, { chainId: 4663, base: BASE, quote: QUOTE, factory: FACTORY }),
    ).rejects.toThrow(/no pool exists/);
  });

  it('asks for a pool or a factory rather than guessing', async () => {
    await expect(
      discoverMarket(node(tokens), { chainId: 4663, base: BASE, quote: QUOTE }),
    ).rejects.toThrow(/pool address or a factory/);
  });

  it('refuses a pair of one token against itself', async () => {
    await expect(
      discoverMarket(node(tokens), { chainId: 4663, base: BASE, quote: BASE, pool: POOL }),
    ).rejects.toThrow(/same token/);
  });
});
