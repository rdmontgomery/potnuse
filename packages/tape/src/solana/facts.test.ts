import { describe, expect, it } from 'vitest';
import { accountData, largestAmounts, solanaTokenFacts, topHolderShare } from './facts.ts';
import { toBase58 } from './mint.ts';

const authority = (fill: number) => new Uint8Array(32).fill(fill);

function mintBase64(opts: { mint?: Uint8Array; freeze?: Uint8Array; supply?: bigint }): string {
  const bytes = new Uint8Array(82);
  const view = new DataView(bytes.buffer);
  if (opts.mint) {
    view.setUint32(0, 1, true);
    bytes.set(opts.mint, 4);
  }
  view.setBigUint64(36, opts.supply ?? 1_000_000_000n, true);
  bytes[44] = 6;
  bytes[45] = 1;
  if (opts.freeze) {
    view.setUint32(46, 1, true);
    bytes.set(opts.freeze, 50);
  }
  return btoa(String.fromCharCode(...bytes));
}

/** An RPC answering from a method table, recording what was asked. */
function rpc(table: Record<string, unknown | (() => never)>) {
  const asked: string[] = [];
  return {
    asked,
    call: async (method: string) => {
      asked.push(method);
      const answer = table[method];
      if (typeof answer === 'function') return (answer as () => never)();
      if (answer === undefined) throw new Error(`no stub for ${method}`);
      return answer;
    },
  };
}

const accountInfo = (data: string) => ({ value: { data: [data, 'base64'], owner: 'Token' } });
const largest = (amounts: string[]) => ({ value: amounts.map((amount) => ({ amount })) });

describe('unwrapping RPC results', () => {
  it('reads base64 account data from the array form', () => {
    expect(accountData(accountInfo(mintBase64({})))).toBeInstanceOf(Uint8Array);
  });

  it('reads it from the bare string form too', () => {
    expect(accountData({ value: { data: mintBase64({}) } })).toBeInstanceOf(Uint8Array);
  });

  it('returns null for an account that does not exist', () => {
    expect(accountData({ value: null })).toBeNull();
    expect(accountData(null)).toBeNull();
  });

  it('reads holder amounts largest first', () => {
    expect(largestAmounts(largest(['100', '900', '500']))).toEqual([900n, 500n, 100n]);
  });

  it('ignores malformed amounts rather than failing the read', () => {
    expect(largestAmounts(largest(['abc', '50', '0']))).toEqual([50n]);
    expect(largestAmounts({ value: 'nope' })).toEqual([]);
  });
});

describe('holder concentration', () => {
  it('skips the account that matches the pool size', () => {
    // The AMM vault is always the largest holder; counting it as a whale
    // would flag every healthy market.
    const share = topHolderShare([800n, 100n, 50n], 1_000n, 800n);
    expect(share.pct).toBe(10);
    expect(share.note).toMatch(/outside the pool/);
  });

  it('falls back to the second largest when the pool size is unknown, and says so', () => {
    const share = topHolderShare([800n, 100n], 1_000n, null);
    expect(share.pct).toBe(10);
    expect(share.note).toMatch(/assuming the largest is the pool/);
  });

  it('reports nothing rather than guessing when only the pool is present', () => {
    expect(topHolderShare([800n], 1_000n, null).pct).toBeNull();
    expect(topHolderShare([800n], 1_000n, 800n).pct).toBeNull();
  });

  it('discounts one account, not a band, so a whale near pool size still counts', () => {
    // On a memecoin a holder sitting at about pool size is common, and
    // exactly the one worth knowing about.
    const share = topHolderShare([500n, 380n, 10n], 1_000n, 500n);
    expect(share.pct).toBe(38);
  });

  it('reports nothing when supply is zero', () => {
    expect(topHolderShare([1n], 0n, null).pct).toBeNull();
  });

  it('discounts the closest account even when it is not the largest', () => {
    const share = topHolderShare([900n, 500n, 20n], 2_000n, 480n);
    expect(share.pct).toBe(45);
  });
});

describe('the facts that decide whether a position can be taken from you', () => {
  it('reports a clean mint as neither mintable nor freezable', async () => {
    const node = rpc({
      getAccountInfo: accountInfo(mintBase64({})),
      getTokenLargestAccounts: largest(['900000000', '50000000']),
    });
    const facts = await solanaTokenFacts(node.call, 'mint');
    expect(facts.canMint).toBe(false);
    expect(facts.canFreeze).toBe(false);
    expect(facts.notes).toContain('mint authority revoked');
  });

  it('reports a live mint authority, and names it', async () => {
    const node = rpc({
      getAccountInfo: accountInfo(mintBase64({ mint: authority(0x11) })),
      getTokenLargestAccounts: largest(['1']),
    });
    const facts = await solanaTokenFacts(node.call, 'mint');
    expect(facts.canMint).toBe(true);
    expect(facts.notes.join(' ')).toContain(toBase58(authority(0x11)));
  });

  it('reports a live freeze authority, which can strand a position', async () => {
    const node = rpc({
      getAccountInfo: accountInfo(mintBase64({ freeze: authority(0x22) })),
      getTokenLargestAccounts: largest(['1']),
    });
    expect((await solanaTokenFacts(node.call, 'mint')).canFreeze).toBe(true);
  });

  it('computes concentration against the real supply, sizing the pool from dollars', async () => {
    // Decimals come from the mint, so the caller passes dollars and a price
    // rather than pre-computing base units it cannot yet know how to scale.
    const node = rpc({
      getAccountInfo: accountInfo(mintBase64({ supply: 1_000n })),
      getTokenLargestAccounts: largest(['600', '250', '10']),
    });
    const facts = await solanaTokenFacts(node.call, 'mint', {
      poolBaseUsd: 0.0006,
      priceUsd: 1,
    });
    expect(facts.topHolderPct).toBe(25);
  });

  it('leaves everything unknown when the node is unreachable, rather than throwing', async () => {
    // A degraded RPC must not become a refusal to look at a token at all;
    // null already means "warn" downstream.
    const node = rpc({
      getAccountInfo: () => {
        throw new Error('ECONNRESET');
      },
    });
    const facts = await solanaTokenFacts(node.call, 'mint');
    expect(facts.canMint).toBeNull();
    expect(facts.canFreeze).toBeNull();
    expect(facts.notes[0]).toMatch(/mint read failed: ECONNRESET/);
  });

  it('keeps the authorities when only the holder read fails', async () => {
    const node = rpc({
      getAccountInfo: accountInfo(mintBase64({})),
      getTokenLargestAccounts: () => {
        throw new Error('429');
      },
    });
    const facts = await solanaTokenFacts(node.call, 'mint');
    expect(facts.canMint).toBe(false);
    expect(facts.topHolderPct).toBeNull();
    expect(facts.notes.join(' ')).toMatch(/holder read failed/);
  });

  it('says so when the account is not an SPL mint', async () => {
    const node = rpc({ getAccountInfo: { value: { data: [btoa('short'), 'base64'] } } });
    const facts = await solanaTokenFacts(node.call, 'mint');
    expect(facts.canMint).toBeNull();
    expect(facts.notes[0]).toMatch(/did not decode/);
  });

  it('does not ask for holders when there is no supply to divide', async () => {
    const node = rpc({ getAccountInfo: accountInfo(mintBase64({ supply: 0n })) });
    await solanaTokenFacts(node.call, 'mint');
    expect(node.asked).not.toContain('getTokenLargestAccounts');
  });
});
