// Module 2 — interval & generator math on Z_12. The single non-trivial
// fact: an interval N generates a cyclic subgroup of Z_12 whose size is
// 12 / gcd(N, 12). N is a generator of Z_12 itself iff gcd(N, 12) = 1,
// which on the clock yields the four interval values {1, 5, 7, 11}.

import { mod12, type PitchClass } from './pitchClass';

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

// Orbit of `step` under Z_12 starting at 0. Returns the visited pitch
// classes in the order they're hit — the natural argument for
// Z12Clock's polygonPath prop. Length is always 12 / gcd(step, 12).
//
// step = 0 is degenerate (orbit is just [0]). Callers should clamp the
// UI to a range that excludes 0.
export function orbit(step: number, start: PitchClass = 0): PitchClass[] {
  const out: PitchClass[] = [];
  const seen = new Set<number>();
  let pc: PitchClass = mod12(start);
  while (!seen.has(pc)) {
    out.push(pc);
    seen.add(pc);
    pc = mod12(pc + step);
  }
  return out;
}

export function orbitSize(step: number): number {
  if (step === 0) return 1;
  return 12 / gcd(step, 12);
}

export function isGenerator(step: number): boolean {
  return gcd(step, 12) === 1;
}

// Interval labels used in the UI — combines the semitone count with the
// usual musical name. Pedagogically useful so the listener can hold
// "step by 7" and "perfect fifth" together as the same fact.
export const INTERVAL_LABELS: Record<number, string> = {
  1: 'm2',
  2: 'M2',
  3: 'm3',
  4: 'M3',
  5: 'P4',
  6: 'TT',
  7: 'P5',
  8: 'm6',
  9: 'M6',
  10: 'm7',
  11: 'M7',
};

// Short pedagogical labels for orbit "shapes" — the result of stepping by
// each interval through Z_12. Used in captions under the clock to make
// the gcd → orbit-shape correspondence concrete.
export function orbitShape(step: number): string {
  const size = orbitSize(step);
  if (size === 12) return 'every pitch class (a generator)';
  if (size === 6) return 'whole-tone scale';
  if (size === 4) return 'diminished seventh';
  if (size === 3) return 'augmented triad';
  if (size === 2) return 'tritone pair';
  return 'fixed point';
}
