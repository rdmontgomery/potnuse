import { describe, expect, it } from 'vitest';
import { decodeMint, fromBase64, toBase58 } from './mint.ts';

/** Build a mint account with the fields we care about. */
function mintBytes(opts: {
  mintAuthority?: Uint8Array | null;
  freezeAuthority?: Uint8Array | null;
  supply?: bigint;
  decimals?: number;
  initialized?: boolean;
  extraBytes?: number;
}): Uint8Array {
  const bytes = new Uint8Array(82 + (opts.extraBytes ?? 0));
  const view = new DataView(bytes.buffer);

  if (opts.mintAuthority) {
    view.setUint32(0, 1, true);
    bytes.set(opts.mintAuthority, 4);
  }
  view.setBigUint64(36, opts.supply ?? 0n, true);
  bytes[44] = opts.decimals ?? 6;
  bytes[45] = (opts.initialized ?? true) ? 1 : 0;
  if (opts.freezeAuthority) {
    view.setUint32(46, 1, true);
    bytes.set(opts.freezeAuthority, 50);
  }
  return bytes;
}

const authority = (fill: number) => new Uint8Array(32).fill(fill);

describe('base58', () => {
  it('encodes a known vector', () => {
    // 32 zero bytes is the system program id, all ones.
    expect(toBase58(new Uint8Array(32))).toBe('1'.repeat(32));
  });

  it('preserves leading zero bytes as leading ones', () => {
    const bytes = new Uint8Array(32);
    bytes[31] = 1;
    expect(toBase58(bytes).startsWith('1')).toBe(true);
  });

  it('produces an address of plausible length for a random key', () => {
    const encoded = toBase58(authority(0xab));
    expect(encoded.length).toBeGreaterThanOrEqual(32);
    expect(encoded.length).toBeLessThanOrEqual(44);
  });
});

describe('decoding a mint', () => {
  it('reports a revoked mint authority as null', () => {
    // The thing we most want to be true, and the thing nobody checks.
    const mint = decodeMint(mintBytes({ supply: 1_000_000n, decimals: 6 }))!;
    expect(mint.mintAuthority).toBeNull();
    expect(mint.freezeAuthority).toBeNull();
  });

  it('reports a live mint authority, which means supply is not fixed', () => {
    const mint = decodeMint(mintBytes({ mintAuthority: authority(0x11) }))!;
    expect(mint.mintAuthority).not.toBeNull();
    expect(mint.mintAuthority).toBe(toBase58(authority(0x11)));
  });

  it('reports a live freeze authority, which can strand a position', () => {
    const mint = decodeMint(mintBytes({ freezeAuthority: authority(0x22) }))!;
    expect(mint.freezeAuthority).toBe(toBase58(authority(0x22)));
    expect(mint.mintAuthority).toBeNull();
  });

  it('reads both authorities independently', () => {
    const mint = decodeMint(
      mintBytes({ mintAuthority: authority(0x11), freezeAuthority: authority(0x22) }),
    )!;
    expect(mint.mintAuthority).toBe(toBase58(authority(0x11)));
    expect(mint.freezeAuthority).toBe(toBase58(authority(0x22)));
  });

  it('reads a supply beyond what a float could hold', () => {
    const supply = 1_000_000_000_000_000_000n;
    expect(decodeMint(mintBytes({ supply }))!.supply).toBe(supply);
  });

  it('reads decimals and initialisation', () => {
    const mint = decodeMint(mintBytes({ decimals: 9, initialized: false }))!;
    expect(mint.decimals).toBe(9);
    expect(mint.initialized).toBe(false);
  });

  it('accepts a token-2022 mint with extensions appended', () => {
    // The base layout is a prefix; requiring exactly 82 bytes would reject
    // every newer token for no reason.
    const mint = decodeMint(mintBytes({ decimals: 6, extraBytes: 120 }));
    expect(mint?.decimals).toBe(6);
  });

  it('refuses anything shorter than the layout rather than reading past it', () => {
    expect(decodeMint(new Uint8Array(40))).toBeNull();
    expect(decodeMint(new Uint8Array(0))).toBeNull();
  });
});

describe('base64 account data', () => {
  it('round-trips through the RPC encoding', () => {
    const bytes = mintBytes({ mintAuthority: authority(0x33), supply: 42n, decimals: 8 });
    const base64 = btoa(String.fromCharCode(...bytes));
    const mint = decodeMint(fromBase64(base64))!;
    expect(mint.supply).toBe(42n);
    expect(mint.decimals).toBe(8);
    expect(mint.mintAuthority).toBe(toBase58(authority(0x33)));
  });
});
