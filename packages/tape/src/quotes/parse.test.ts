import { describe, expect, it } from 'vitest';
import { barsIn, byLiquidity, pairsIn } from './parse.ts';

/** A flat, camelCase payload of the kind screener APIs tend to return. */
const flatShape = {
  schemaVersion: '1.0.0',
  pairs: [
    {
      chainId: 'solana',
      dexId: 'raydium',
      pairAddress: '8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj',
      baseToken: {
        address: 'B4Vwozy1FGtp8SELXSXydWSzavPUGnJ77DURV2k4MhUV',
        symbol: 'PENGU',
      },
      quoteToken: { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
      priceNative: '0.0000121',
      priceUsd: '0.002314',
      liquidity: { usd: 1_842_000 },
      volume: { h24: 9_120_000 },
    },
  ],
};

/** A nested, snake_case payload with attributes and relationships. */
const attributeShape = {
  data: [
    {
      id: 'robinhood_0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27',
      type: 'pool',
      attributes: {
        address: '0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27',
        name: 'AI / NVDAx',
        base_token_price_usd: '0.1097',
        reserve_in_usd: '1950000.0',
        volume_usd: { h24: '4400000' },
      },
      relationships: {
        network: { data: { id: 'robinhood' } },
        dex: { data: { id: 'uniswap-v4' } },
      },
    },
  ],
};

describe('pair extraction survives shapes it has never seen', () => {
  it('reads a flat camelCase payload', () => {
    const [pair] = pairsIn(flatShape);
    expect(pair?.chain).toBe('solana');
    expect(pair?.dex).toBe('raydium');
    expect(pair?.baseSymbol).toBe('PENGU');
    expect(pair?.quoteSymbol).toBe('SOL');
    expect(pair?.priceUsd).toBeCloseTo(0.002314, 9);
    expect(pair?.liquidityUsd).toBe(1_842_000);
    expect(pair?.volume24hUsd).toBe(9_120_000);
  });

  it('reads a nested snake_case payload with attributes and relationships', () => {
    const [pair] = pairsIn(attributeShape);
    expect(pair?.chain).toBe('robinhood');
    expect(pair?.dex).toBe('uniswap-v4');
    expect(pair?.priceUsd).toBeCloseTo(0.1097, 6);
    expect(pair?.liquidityUsd).toBe(1_950_000);
  });

  it('splits a combined name when there are no structured symbols', () => {
    const [pair] = pairsIn(attributeShape);
    expect(pair?.baseSymbol).toBe('AI');
    expect(pair?.quoteSymbol).toBe('NVDAx');
  });

  it('strips a chain prefix from the identifier', () => {
    // "robinhood_0x…" is the aggregator's key, not the pool's id.
    expect(pairsIn(attributeShape)[0]?.pairId.startsWith('0x')).toBe(true);
  });

  it('accepts a numeric chain id', () => {
    const [pair] = pairsIn({ pairs: [{ chainId: 8453, address: '0xabc', priceUsd: 1 }] });
    expect(pair?.chain).toBe('8453');
  });

  it('finds pairs however deeply they are buried', () => {
    const buried = { result: { data: { items: { list: flatShape.pairs } } } };
    expect(pairsIn(buried)).toHaveLength(1);
  });
});

describe('the identifier stays opaque', () => {
  // This is the assumption that cost a week: pair ids are not EVM addresses.
  it('keeps a base58 Solana pool id intact', () => {
    expect(pairsIn(flatShape)[0]?.pairId).toBe('8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj');
  });

  it('keeps a 32-byte V4 pool id intact rather than truncating it', () => {
    expect(pairsIn(attributeShape)[0]?.pairId).toBe(
      '0xcbdfea90430a30ee4469c9902e120a77e7c7e4711d5643671c1d1957f2f1ce27',
    );
  });

  it('keeps an ordinary 20-byte pair address intact', () => {
    const [pair] = pairsIn({
      pairs: [{ chainId: 'base', pairAddress: '0x' + 'ab'.repeat(20), priceUsd: 0.5 }],
    });
    expect(pair?.pairId).toBe('0x' + 'ab'.repeat(20));
  });
});

describe('what is not a pair', () => {
  it('ignores an object with an id but nothing priceable', () => {
    expect(pairsIn({ data: [{ id: 'x', type: 'token', attributes: { name: 'Thing' } }] })).toEqual(
      [],
    );
  });

  it('ignores an object priced but unidentifiable', () => {
    expect(pairsIn({ pairs: [{ priceUsd: '1.00' }] })).toEqual([]);
  });

  it('returns nothing for an error body rather than throwing', () => {
    expect(pairsIn({ errors: [{ status: '404', title: 'Not Found' }] })).toEqual([]);
    expect(pairsIn(null)).toEqual([]);
    expect(pairsIn('a string')).toEqual([]);
  });

  it('accepts a pair with depth but no price, since it can still be screened', () => {
    const [pair] = pairsIn({ pairs: [{ address: '0xabc', liquidity: { usd: 500 } }] });
    expect(pair?.priceUsd).toBeNull();
    expect(pair?.liquidityUsd).toBe(500);
  });

  it('deduplicates the same pair reached by two paths', () => {
    const twice = { a: flatShape.pairs, b: flatShape.pairs };
    expect(pairsIn(twice)).toHaveLength(1);
  });

  it('stops rather than walking an enormous response forever', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      chainId: 'base',
      address: `0x${i.toString(16).padStart(40, '0')}`,
      priceUsd: 1,
    }));
    expect(pairsIn({ pairs: many }, 10)).toHaveLength(10);
  });
});

describe('ranking', () => {
  it('puts the deepest pool first', () => {
    const pairs = pairsIn({
      pairs: [
        { chainId: 'base', address: '0xa', priceUsd: 1, liquidity: { usd: 100 } },
        { chainId: 'base', address: '0xb', priceUsd: 1, liquidity: { usd: 900 } },
      ],
    });
    expect(byLiquidity(pairs)[0]?.pairId).toBe('0xb');
  });

  it('sorts a pool with no depth figure last rather than first', () => {
    const pairs = pairsIn({
      pairs: [
        { chainId: 'base', address: '0xa', priceUsd: 1 },
        { chainId: 'base', address: '0xb', priceUsd: 1, liquidity: { usd: 5 } },
      ],
    });
    expect(byLiquidity(pairs).map((p) => p.pairId)).toEqual(['0xb', '0xa']);
  });
});

describe('candles', () => {
  it('reads the near-universal array form', () => {
    const bars = barsIn({ data: { attributes: { ohlcv_list: [[1_700_000_000, 1, 1.5, 0.8, 1.2, 500]] } } });
    expect(bars).toHaveLength(1);
    expect(bars[0]).toEqual({ t: 1_700_000_000_000, open: 1, high: 1.5, low: 0.8, close: 1.2, volume: 500 });
  });

  it('normalises seconds and milliseconds by magnitude, not by trusting a unit', () => {
    const [seconds] = barsIn([[1_700_000_000, 1, 1, 1, 1]]);
    const [millis] = barsIn([[1_700_000_000_000, 1, 1, 1, 1]]);
    expect(seconds?.t).toBe(millis?.t);
  });

  it('reads the object form', () => {
    const bars = barsIn({ candles: [{ time: 1_700_000_060, o: 2, h: 3, l: 1, c: 2.5, v: 10 }] });
    expect(bars[0]?.high).toBe(3);
    expect(bars[0]?.low).toBe(1);
  });

  it('returns bars oldest first however the source ordered them', () => {
    const bars = barsIn([
      [1_700_000_120, 3, 3, 3, 3],
      [1_700_000_000, 1, 1, 1, 1],
      [1_700_000_060, 2, 2, 2, 2],
    ]);
    expect(bars.map((b) => b.open)).toEqual([1, 2, 3]);
  });

  it('carries a null volume rather than inventing zero', () => {
    expect(barsIn([[1_700_000_000, 1, 1, 1, 1]])[0]?.volume).toBeNull();
  });

  it('finds nothing in a payload with no candles', () => {
    expect(barsIn({ error: 'no data' })).toEqual([]);
    expect(barsIn([[1, 2]])).toEqual([]);
  });
});
