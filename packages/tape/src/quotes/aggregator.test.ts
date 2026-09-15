import { describe, expect, it } from 'vitest';
import { ENDPOINTS, aggregatorSource, probeToken, type Endpoint } from './aggregator.ts';

const TOKEN = 'B4Vwozy1FGtp8SELXSXydWSzavPUGnJ77DURV2k4MhUV';

const pairBody = (id: string, liquidity: number) => ({
  pairs: [
    {
      chainId: 'solana',
      dexId: 'raydium',
      pairAddress: id,
      baseToken: { address: TOKEN, symbol: 'PENGU' },
      quoteToken: { address: 'So111', symbol: 'SOL' },
      priceUsd: '0.0231',
      liquidity: { usd: liquidity },
      volume: { h24: 900_000 },
    },
  ],
});

const barBody = {
  data: { attributes: { ohlcv_list: [[1_700_000_000, 1, 1.4, 0.9, 1.2, 500]] } },
};

/** A fetch that answers from a URL-substring table and records what was asked. */
function net(routes: [match: string, body: unknown, status?: number][]) {
  const asked: string[] = [];
  const fetchImpl = (async (url: string) => {
    asked.push(url);
    for (const [match, body, status] of routes) {
      if (url.includes(match)) {
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status: status ?? 200,
        });
      }
    }
    return new Response('{"errors":[{"status":"404"}]}', { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchImpl, asked };
}

describe('the endpoint list', () => {
  it('substitutes the token into every pairs URL', () => {
    for (const endpoint of ENDPOINTS) {
      if (endpoint.pairs) expect(endpoint.pairs).toContain('{token}');
    }
  });

  it('gives any bars URL the placeholders it needs', () => {
    for (const endpoint of ENDPOINTS) {
      if (!endpoint.bars) continue;
      expect(endpoint.bars).toContain('{chain}');
      expect(endpoint.bars).toContain('{pair}');
    }
  });

  it('maps bar widths onto coarser timeframes as they grow', () => {
    const gecko = ENDPOINTS.find((e) => e.timeframe)!;
    expect(gecko.timeframe!(5)).toBe('minute');
    expect(gecko.timeframe!(60)).toBe('hour');
    expect(gecko.timeframe!(1440)).toBe('day');
  });
});

describe('probing', () => {
  it('reports every endpoint, including the ones that failed', async () => {
    const { fetchImpl } = net([['dexscreener.com/latest/dex/tokens', pairBody('pool1', 100)]]);
    const report = await probeToken(TOKEN, { fetchImpl });
    expect(report.attempts.length).toBeGreaterThan(1);
    expect(report.attempts.filter((a) => a.pairs.length > 0)).toHaveLength(1);
    expect(report.attempts.some((a) => a.error?.includes('404'))).toBe(true);
  });

  it('carries the status, size and start of each body for diagnosis', async () => {
    const { fetchImpl } = net([['dexscreener', pairBody('pool1', 100)]]);
    const [first] = (await probeToken(TOKEN, { fetchImpl })).attempts;
    expect(first?.status).toBe(200);
    expect(first?.bytes).toBeGreaterThan(0);
    expect(first?.sample).toContain('PENGU');
  });

  it('takes the deepest pair found across all endpoints', async () => {
    const { fetchImpl } = net([
      ['dex/tokens', pairBody('shallow', 1_000)],
      ['dex/search', pairBody('deep', 900_000)],
    ]);
    expect((await probeToken(TOKEN, { fetchImpl })).best?.pairId).toBe('deep');
  });

  it('says a body was not JSON rather than throwing', async () => {
    const { fetchImpl } = net([['dexscreener', '<html>rate limited</html>']]);
    const report = await probeToken(TOKEN, { fetchImpl });
    expect(report.attempts.some((a) => a.error === 'not JSON')).toBe(true);
    expect(report.best).toBeNull();
  });

  it('records a network failure against that endpoint alone', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes('dexscreener')) throw new Error('ETIMEDOUT');
      return new Response(JSON.stringify(pairBody('ok', 5)), { status: 200 });
    }) as unknown as typeof fetch;
    const report = await probeToken(TOKEN, { fetchImpl });
    expect(report.attempts.some((a) => a.error === 'ETIMEDOUT')).toBe(true);
    expect(report.best?.pairId).toBe('ok');
  });

  it('reports nothing found rather than pretending', async () => {
    const { fetchImpl } = net([]);
    const report = await probeToken(TOKEN, { fetchImpl });
    expect(report.best).toBeNull();
    expect(report.attempts.every((a) => a.pairs.length === 0)).toBe(true);
  });
});

describe('the source', () => {
  it('takes the first endpoint that yields pairs', async () => {
    const { fetchImpl, asked } = net([['dex/tokens', pairBody('pool1', 100)]]);
    const pairs = await aggregatorSource({ fetchImpl }).pairsFor(TOKEN);
    expect(pairs).toHaveLength(1);
    // Having found one, it does not keep asking.
    expect(asked).toHaveLength(1);
  });

  it('falls through to the next when one is down', async () => {
    const { fetchImpl, asked } = net([['dex/search', pairBody('pool2', 50)]]);
    const pairs = await aggregatorSource({ fetchImpl }).pairsFor(TOKEN);
    expect(pairs[0]?.pairId).toBe('pool2');
    expect(asked.length).toBeGreaterThan(1);
  });

  it('returns an empty list when nobody knows the token', async () => {
    const { fetchImpl } = net([]);
    expect(await aggregatorSource({ fetchImpl }).pairsFor(TOKEN)).toEqual([]);
  });

  it('fetches candles for a pair', async () => {
    const { fetchImpl, asked } = net([['ohlcv', barBody]]);
    const source = aggregatorSource({ fetchImpl });
    const bars = await source.bars(
      { ...(await source.pairsFor(TOKEN))[0]!, chain: 'solana', pairId: 'pool1' } as never,
      { minutes: 5 },
    ).catch(() => []);
    expect(asked.some((url) => url.includes('ohlcv'))).toBe(true);
    expect(bars[0]?.high).toBe(1.4);
  });

  it('puts the chain and pair into the candles URL', async () => {
    const { fetchImpl, asked } = net([['ohlcv', barBody]]);
    await aggregatorSource({ fetchImpl }).bars({
      chain: 'robinhood',
      pairId: '0xcbdf',
      dex: null,
      baseSymbol: null,
      baseAddress: null,
      quoteSymbol: null,
      quoteAddress: null,
      priceUsd: 1,
      priceNative: null,
      liquidityUsd: 1,
      volume24hUsd: null,
    });
    const url = asked.find((u) => u.includes('ohlcv'))!;
    expect(url).toContain('/robinhood/');
    expect(url).toContain('0xcbdf');
  });

  it('honours a bar limit by keeping the most recent', async () => {
    const many = {
      data: {
        attributes: {
          ohlcv_list: Array.from({ length: 10 }, (_, i) => [1_700_000_000 + i * 60, 1, 1, 1, i]),
        },
      },
    };
    const { fetchImpl } = net([['ohlcv', many]]);
    const bars = await aggregatorSource({ fetchImpl }).bars(
      { chain: 'x', pairId: 'y' } as never,
      { limit: 3 },
    );
    expect(bars.map((b) => b.close)).toEqual([7, 8, 9]);
  });

  it('accepts a replacement endpoint list, so a bad URL is a one-line fix', async () => {
    const custom: Endpoint[] = [{ name: 'mine', pairs: 'https://example.invalid/t/{token}' }];
    const { fetchImpl, asked } = net([['example.invalid', pairBody('custom', 1)]]);
    const pairs = await aggregatorSource({ fetchImpl, endpoints: custom }).pairsFor(TOKEN);
    expect(pairs[0]?.pairId).toBe('custom');
    expect(asked[0]).toContain('example.invalid');
  });
});
