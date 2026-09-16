import { describe, expect, it } from 'vitest';
import { cachedFetch, isRefusal, memoryCache, ttlFor } from './cache.ts';

function net(handler: (url: string) => { body: string; status: number } | Error) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const result = handler(url);
    if (result instanceof Error) throw result;
    return new Response(result.body, { status: result.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const ok = () => ({ body: '{"pairs":[]}', status: 200 });
const limited = () => ({ body: 'error code: 1015', status: 429 });

describe('what counts as a refusal', () => {
  it('treats rate limits, forbidden and server errors alike', () => {
    expect(isRefusal(429)).toBe(true);
    expect(isRefusal(403)).toBe(true);
    expect(isRefusal(503)).toBe(true);
    expect(isRefusal(200)).toBe(false);
    expect(isRefusal(404)).toBe(false);
  });

  it('keeps a refusal cached far longer than a good body', () => {
    expect(ttlFor(429)).toBeGreaterThan(ttlFor(200));
  });
});

describe('fetching through a cache', () => {
  it('asks upstream once and serves the rest from the cache', async () => {
    const cache = memoryCache();
    const { fetchImpl, calls } = net(ok);
    let clock = 1_000;
    const now = () => clock;

    await cachedFetch('https://x/a', { cache, fetchImpl, now });
    clock += 30_000;
    const second = await cachedFetch('https://x/a', { cache, fetchImpl, now });

    expect(calls).toHaveLength(1);
    expect(second.fromCache).toBe(true);
  });

  it('asks again once the entry has gone stale', async () => {
    const cache = memoryCache();
    const { fetchImpl, calls } = net(ok);
    let clock = 1_000;
    const now = () => clock;

    await cachedFetch('https://x/a', { cache, fetchImpl, now, policy: { okMs: 10_000 } });
    clock += 11_000;
    await cachedFetch('https://x/a', { cache, fetchImpl, now, policy: { okMs: 10_000 } });
    expect(calls).toHaveLength(2);
  });

  it('caches a rate limit, because retrying into one is how it becomes permanent', async () => {
    const cache = memoryCache();
    const { fetchImpl, calls } = net(limited);
    let clock = 1_000;
    const now = () => clock;

    const first = await cachedFetch('https://x/a', { cache, fetchImpl, now });
    clock += 60_000;
    const second = await cachedFetch('https://x/a', { cache, fetchImpl, now });

    expect(first.entry.status).toBe(429);
    expect(second.fromCache).toBe(true);
    expect(second.entry.status).toBe(429);
    expect(calls).toHaveLength(1);
  });

  it('tries again after the backoff expires', async () => {
    const cache = memoryCache();
    let limitedNow = true;
    const { fetchImpl } = net(() => (limitedNow ? limited() : ok()));
    let clock = 1_000;
    const now = () => clock;

    await cachedFetch('https://x/a', { cache, fetchImpl, now, policy: { backoffMs: 1_000 } });
    clock += 2_000;
    limitedNow = false;
    const second = await cachedFetch('https://x/a', { cache, fetchImpl, now, policy: { backoffMs: 1_000 } });
    expect(second.entry.status).toBe(200);
  });

  it('backs off on a timeout rather than retrying into it', async () => {
    const cache = memoryCache();
    const { fetchImpl, calls } = net(() => new Error('TimeoutError'));
    let clock = 1_000;
    const now = () => clock;

    const first = await cachedFetch('https://x/a', { cache, fetchImpl, now });
    clock += 1_000;
    await cachedFetch('https://x/a', { cache, fetchImpl, now });

    expect(first.entry.status).toBe(0);
    expect(first.entry.body).toContain('Timeout');
    expect(calls).toHaveLength(1);
  });

  it('keys separately per URL', async () => {
    const cache = memoryCache();
    const { fetchImpl, calls } = net(ok);
    const now = () => 1_000;
    await cachedFetch('https://x/a', { cache, fetchImpl, now });
    await cachedFetch('https://x/b', { cache, fetchImpl, now });
    expect(calls).toHaveLength(2);
    expect(cache.size()).toBe(2);
  });

  it('works with no cache at all', async () => {
    const { fetchImpl, calls } = net(ok);
    await cachedFetch('https://x/a', { fetchImpl });
    await cachedFetch('https://x/a', { fetchImpl });
    expect(calls).toHaveLength(2);
  });

  it('does not let a broken cache break the fetch', async () => {
    const broken = {
      get: async () => {
        throw new Error('d1 down');
      },
      put: async () => {
        throw new Error('d1 down');
      },
    };
    const { fetchImpl } = net(ok);
    const result = await cachedFetch('https://x/a', { cache: broken, fetchImpl });
    expect(result.entry.status).toBe(200);
  });
});
