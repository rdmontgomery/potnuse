// Module 11 — music as active matter. Read tonality through the lens
// of statistical physics: the inferred key is the system's
// <em>order parameter</em>, and the strength of that order can be
// dialed up or down by injecting noise (the "temperature") into the
// observed pc distribution.
//
// At low temperature the histogram looks like a clean Krumhansl
// profile and the model locks onto a single key. As T rises, the
// noise level approaches the profile's own amplitudes and the
// inference becomes ambiguous — different keys win on different
// frames. Modulation, in this view, is a phase transition where the
// order parameter rotates from one tonic-vector to another.

import { rankKeys, type KeyMatch } from './krumhansl';
import { mod12, pitchClassOf } from './pitchClass';
import { CHORALE_PHRASE } from './chorale-phrase';

// Deterministic pseudo-random source so the temperature animations
// are reproducible across page loads. Mulberry32 — small, fine-grained
// enough for adding noise to a 12-vector.
export function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Histogram of the chorale's full content (both voices), weighted by
// duration. Used as the cold-state reference distribution.
export function choraleHistogram(): number[] {
  const hist = new Array(12).fill(0);
  for (const n of CHORALE_PHRASE.notes) {
    hist[mod12(pitchClassOf(n.pitch))] += n.dur;
  }
  return hist;
}

// Add temperature-scaled noise to a histogram. Each pc gets a fresh
// random non-negative bump proportional to T; at T = 0 the input is
// returned unchanged.
export function thermalize(
  hist: readonly number[],
  T: number,
  rng: () => number,
): number[] {
  return hist.map((v) => v + T * rng());
}

// Single-number "order strength": the best correlation among the 24
// keys. High = tonality is unambiguous. Approaches zero from above as
// noise drowns out the underlying profile.
export function orderStrength(hist: readonly number[]): {
  best: KeyMatch;
  runnerUp: KeyMatch;
  margin: number;
} {
  const ranked = rankKeys(hist);
  const best = ranked[0];
  const runnerUp = ranked[1];
  return { best, runnerUp, margin: best.correlation - runnerUp.correlation };
}
