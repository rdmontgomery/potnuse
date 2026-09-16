/**
 * The SPL token mint account.
 *
 * A fixed 82-byte layout, little-endian, stable since the program shipped:
 *
 *   0  mintAuthorityOption   u32   0 = none, 1 = present
 *   4  mintAuthority         [u8;32]
 *   36 supply                u64
 *   44 decimals              u8
 *   45 isInitialized         u8
 *   46 freezeAuthorityOption u32
 *   50 freezeAuthority       [u8;32]
 *
 * The two `Option` discriminants are the whole reason to read this. A mint
 * authority that has not been revoked means the supply is not fixed and your
 * share of it can be diluted at any moment. A freeze authority means your
 * token account can be frozen — you hold the position but cannot sell it,
 * which is a honeypot with extra steps.
 */

export interface MintAccount {
  /** Base58 authority, or null when revoked. */
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: bigint;
  decimals: number;
  initialized: boolean;
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Encode 32 bytes as base58, the form every Solana tool shows. */
export function toBase58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);

  let out = '';
  while (value > 0n) {
    out = B58[Number(value % 58n)]! + out;
    value /= 58n;
  }
  // Leading zero bytes are significant and encode as '1'.
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `1${out}`;
  }
  return out === '' ? '1' : out;
}

export function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const readU32 = (bytes: Uint8Array, at: number): number =>
  bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24);

const readU64 = (bytes: Uint8Array, at: number): bigint => {
  let value = 0n;
  for (let i = 7; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[at + i]!);
  return value;
};

export function decodeMint(bytes: Uint8Array): MintAccount | null {
  // A token-2022 mint carries extensions after the base layout, so accept
  // anything at least this long rather than requiring exactly 82.
  if (bytes.length < 82) return null;

  const hasMintAuthority = readU32(bytes, 0) === 1;
  const hasFreezeAuthority = readU32(bytes, 46) === 1;

  return {
    mintAuthority: hasMintAuthority ? toBase58(bytes.slice(4, 36)) : null,
    freezeAuthority: hasFreezeAuthority ? toBase58(bytes.slice(50, 82)) : null,
    supply: readU64(bytes, 36),
    decimals: bytes[44]!,
    initialized: bytes[45] === 1,
  };
}
