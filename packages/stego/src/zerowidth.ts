// Zero-width steganography for plain text.
//
// Bits are encoded as two invisible characters and framed by a third so a
// decoder can find the payload inside arbitrary surrounding prose:
//
//   ZERO  = U+200B (zero-width space)         -> bit 0
//   ONE   = U+200C (zero-width non-joiner)    -> bit 1
//   FRAME = U+2060 (word joiner)              -> payload boundary
//
// A payload is the FRAME, then 8 bits per UTF-8 byte, then FRAME. Anything
// between the two FRAME markers that isn't ZERO or ONE is ignored, so paste-
// through-a-rich-text-editor noise still decodes.

const ZERO = '​';
const ONE = '‌';
const FRAME = '⁠';

// All zero-width / formatting characters this codec emits, plus a couple
// stray ones that other tools sometimes inject (ZWJ, BOM). Used by strip()
// and the "n invisible characters" counter in the UI.
const STRIPPABLE_RE = /[​-‍⁠﻿]/g;

export const CHARS = { ZERO, ONE, FRAME } as const;

/** Encode a payload as a framed zero-width sequence. */
export function encode(payload: string): string {
  if (payload === '') return FRAME + FRAME;
  const bytes = new TextEncoder().encode(payload);
  let out = FRAME;
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      out += (byte >> i) & 1 ? ONE : ZERO;
    }
  }
  out += FRAME;
  return out;
}

/** Decode the first framed payload found in input. Null if none or malformed. */
export function decode(input: string): string | null {
  const start = input.indexOf(FRAME);
  if (start < 0) return null;
  const end = input.indexOf(FRAME, start + 1);
  if (end < 0) return null;

  const between = input.slice(start + 1, end);
  let bits = '';
  for (const ch of between) {
    if (ch === ZERO) bits += '0';
    else if (ch === ONE) bits += '1';
  }
  if (bits.length === 0) return '';
  if (bits.length % 8 !== 0) return null;

  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Append a framed payload to a carrier. The carrier renders unchanged. */
export function embed(carrier: string, payload: string): string {
  return carrier + encode(payload);
}

/** Alias for decode. */
export const extract = decode;

/** Remove every zero-width/formatting character this codec might leave behind. */
export function strip(input: string): string {
  return input.replace(STRIPPABLE_RE, '');
}

/** True iff input contains a complete frame pair (two FRAME markers). */
export function hasPayload(input: string): boolean {
  const start = input.indexOf(FRAME);
  if (start < 0) return false;
  return input.indexOf(FRAME, start + 1) > start;
}

/** Count invisible characters in input — useful as a paranoia gauge. */
export function countInvisibles(input: string): number {
  const matches = input.match(STRIPPABLE_RE);
  return matches ? matches.length : 0;
}
