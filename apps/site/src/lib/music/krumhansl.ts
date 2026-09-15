// Module 9 — statistical tonality. Carol Krumhansl's probe-tone
// experiments produced empirical "fit" profiles for each pitch class
// within a major or minor key context (Krumhansl & Kessler 1982).
// The probe-tone profile is the 12-vector of average fit ratings; the
// tonic ranks highest, the dominant next, then the mediant, etc.
//
// Key-finding by correlation: take a passage's pc histogram (weighted
// by duration), correlate against all 24 rotations of the major and
// minor profiles, and pick the maximally-correlated (tonic, mode).
// The procedure works strikingly well for tonal music; it's the
// canonical statistical view of "which key am I in?"

import { mod12, type PitchClass } from './pitchClass';

// Major-key probe-tone profile, Krumhansl-Kessler 1982. Index 0 is
// the tonic; the vector is fit ratings for each scale degree.
export const MAJOR_PROFILE: readonly number[] = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

// Minor-key profile, same study.
export const MINOR_PROFILE: readonly number[] = [
  6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

// Rotate a profile so that index 0 corresponds to pc `tonic` (rather
// than pc 0). Used when correlating against keys other than C major /
// C minor.
function rotateProfile(
  profile: readonly number[],
  tonic: PitchClass,
): number[] {
  return profile.map((_, i) => profile[mod12(i - tonic)]);
}

// Pearson correlation coefficient between two equal-length vectors.
function correlation(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

export type Mode = 'major' | 'minor';

export interface KeyMatch {
  tonic: PitchClass;
  mode: Mode;
  correlation: number;
}

// Take a pc-histogram (a 12-vector of weights) and rank all 24 keys
// by Pearson correlation against their probe-tone profiles. Highest-
// correlated key is at index 0.
export function rankKeys(histogram: readonly number[]): KeyMatch[] {
  if (histogram.length !== 12) {
    throw new Error('histogram must have 12 entries');
  }
  const out: KeyMatch[] = [];
  for (let tonic = 0 as PitchClass; tonic < 12; tonic++) {
    out.push({
      tonic,
      mode: 'major',
      correlation: correlation(histogram, rotateProfile(MAJOR_PROFILE, tonic)),
    });
    out.push({
      tonic,
      mode: 'minor',
      correlation: correlation(histogram, rotateProfile(MINOR_PROFILE, tonic)),
    });
  }
  out.sort((a, b) => b.correlation - a.correlation);
  return out;
}

// Build a pc-histogram from a list of (pc, weight) pairs — the canonical
// weight is duration in beats or seconds.
export function buildHistogram(
  events: readonly { pc: PitchClass; weight: number }[],
): number[] {
  const hist = new Array(12).fill(0);
  for (const e of events) hist[mod12(e.pc)] += e.weight;
  return hist;
}
