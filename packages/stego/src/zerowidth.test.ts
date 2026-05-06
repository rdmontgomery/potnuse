import { describe, expect, it } from 'vitest';
import {
  CHARS,
  countInvisibles,
  decode,
  embed,
  encode,
  extract,
  hasPayload,
  strip,
} from './zerowidth.ts';

const { ZERO, ONE, FRAME } = CHARS;

describe('zero-width codec', () => {
  it('round-trips ASCII payloads', () => {
    const payload = 'the body is the message.';
    expect(decode(encode(payload))).toBe(payload);
  });

  it('round-trips multi-byte UTF-8 payloads', () => {
    for (const payload of ['Histiaeus', 'café — Trystero', '日本語', '\u{1F47B}']) {
      expect(decode(encode(payload))).toBe(payload);
    }
  });

  it('encodes empty payload as a bare frame pair', () => {
    expect(encode('')).toBe(FRAME + FRAME);
    expect(decode(FRAME + FRAME)).toBe('');
  });

  it('produces only invisible characters', () => {
    const out = encode('hi');
    // every char in the output is one of our three symbols
    for (const ch of out) {
      expect([ZERO, ONE, FRAME]).toContain(ch);
    }
  });

  it('embeds invisibly into a carrier (visible text identical after strip)', () => {
    const carrier = 'shave my head and read.';
    const stamped = embed(carrier, 'the body is the message.');
    expect(strip(stamped)).toBe(carrier);
    expect(extract(stamped)).toBe('the body is the message.');
  });

  it('decodes the first payload when many are concatenated', () => {
    const a = encode('first');
    const b = encode('second');
    expect(decode('prefix ' + a + ' middle ' + b + ' suffix')).toBe('first');
  });

  it('tolerates visible noise pasted between the two frame markers', () => {
    // someone pastes a payload through a rich-text editor that wraps it in
    // visible characters; the decoder should still pull the bits out.
    const stamped = encode('ok');
    const noisy =
      stamped.slice(0, 1) +
      'noise ' +
      stamped.slice(1, -1) +
      ' more noise' +
      stamped.slice(-1);
    expect(decode(noisy)).toBe('ok');
  });

  it('returns null when no frame is present', () => {
    expect(decode('plain prose, nothing hidden')).toBeNull();
    expect(decode('')).toBeNull();
  });

  it('returns null for malformed (non-multiple-of-8) bit runs', () => {
    expect(decode(FRAME + ZERO + ONE + ZERO + FRAME)).toBeNull();
  });

  it('returns null for invalid UTF-8 byte sequences', () => {
    // 0xFF is never a valid start byte in UTF-8.
    let bits = '';
    for (let i = 7; i >= 0; i--) bits += '1';
    let payload = FRAME;
    for (const bit of bits) payload += bit === '1' ? ONE : ZERO;
    payload += FRAME;
    expect(decode(payload)).toBeNull();
  });

  it('strip removes all known zero-width characters', () => {
    const stamped = embed('hello world', 'x');
    expect(strip(stamped)).toBe('hello world');
    expect(strip('plain')).toBe('plain');
    // also handles ZWJ and BOM, which we don't emit but might encounter.
    expect(strip('a‍b﻿c')).toBe('abc');
  });

  it('hasPayload reports true only for complete frame pairs', () => {
    expect(hasPayload(encode('x'))).toBe(true);
    expect(hasPayload('plain text')).toBe(false);
    expect(hasPayload('only ' + FRAME + ' one frame')).toBe(false);
  });

  it('countInvisibles counts the framing and bit characters', () => {
    // 'a' = 1 byte = 8 bits, plus two FRAME markers => 10 invisibles
    expect(countInvisibles(encode('a'))).toBe(10);
    expect(countInvisibles('nothing here')).toBe(0);
  });
});
