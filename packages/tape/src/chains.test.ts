import { describe, expect, it } from 'vitest';
import { CHAINS, chainById, chainsHolding, probeChains, type ChainProfile } from './chains.ts';
import type { EthCall } from './feed/types.ts';
import type { Address } from './types.ts';

const TOKEN: Address = '0x00000000000000000000000000000000000000aa';
const word = (v: bigint) => v.toString(16).padStart(64, '0');

/** Chains where the token answers decimals(), by chain id. */
function callFor(present: Record<number, bigint | 'garbage'>) {
  return (chain: ChainProfile): EthCall =>
    async () => {
      const answer = present[chain.id];
      if (answer === undefined) throw new Error('execution reverted');
      if (answer === 'garbage') return `0x${word(255n)}` as `0x${string}`;
      return `0x${word(answer)}` as `0x${string}`;
    };
}

describe('the registry', () => {
  it('carries the chains worth trying, Robinhood Chain first', () => {
    expect(CHAINS[0]?.id).toBe(4663);
    expect(CHAINS.map((c) => c.id)).toEqual([4663, 1, 8453, 42161]);
  });

  it('gives every chain an RPC and a token-substituting indexer', () => {
    for (const chain of CHAINS) {
      expect(chain.rpcUrl).toMatch(/^https:\/\//);
      expect(chain.indexer).toContain('{token}');
    }
  });

  it('looks a chain up by id', () => {
    expect(chainById(8453)?.name).toBe('Base');
    expect(chainById(999_999)).toBeUndefined();
  });
});

describe('probing', () => {
  it('finds the one chain a token is deployed on', async () => {
    const probes = await probeChains(TOKEN, callFor({ 1: 18n }));
    expect(chainsHolding(probes).map((c) => c.id)).toEqual([1]);
  });

  it('returns every chain that answers, rather than picking one silently', async () => {
    // The same twenty bytes really can be a token on several chains, and
    // choosing for someone would be worse than telling them.
    const probes = await probeChains(TOKEN, callFor({ 1: 18n, 8453: 18n }));
    expect(chainsHolding(probes).map((c) => c.id)).toEqual([1, 8453]);
  });

  it('reports nothing when the token is nowhere we know', async () => {
    expect(chainsHolding(await probeChains(TOKEN, callFor({})))).toEqual([]);
  });

  it('treats an implausible decimals answer as not a token', async () => {
    // A contract that is not a token still answers something.
    expect(chainsHolding(await probeChains(TOKEN, callFor({ 1: 'garbage' })))).toEqual([]);
  });

  it('keeps the decimals it read, so the caller need not ask twice', async () => {
    const probes = await probeChains(TOKEN, callFor({ 8453: 6n }));
    expect(probes.find((p) => p.chain.id === 8453)?.decimals).toBe(6);
  });

  it('lets one chain being down cost only that chain', async () => {
    const probes = await probeChains(TOKEN, (chain) => async () => {
      if (chain.id === 4663) throw new Error('ETIMEDOUT');
      return `0x${word(18n)}` as `0x${string}`;
    });
    expect(chainsHolding(probes).map((c) => c.id)).toEqual([1, 8453, 42161]);
  });

  it('probes only the chains it is given', async () => {
    const probes = await probeChains(TOKEN, callFor({ 1: 18n }), [chainById(1)!]);
    expect(probes).toHaveLength(1);
  });
});
