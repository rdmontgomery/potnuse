// The first eight partials of an arbitrary fundamental. Pitch labels are
// the nearest equal-tempered note; ratios are the exact integer multiples
// of the fundamental's frequency. The 7th partial is famously ~31 cents
// flat of equal-tempered B♭ — flagged here so the UI can mark it.
//
// Module 1 leans on this directly: the lowest non-octave-redundant
// partials (3, 5) hand you a perfect fifth and a major third, and the
// triad emerges at partials 4-5-6 regardless of fundamental.

import type { PitchClass } from './pitchClass';

export interface Partial {
  // 1-indexed partial number (1 = fundamental, 2 = octave, …).
  n: number;
  // Exact integer ratio to the fundamental's frequency.
  ratio: number;
  // Semitones above the fundamental, rounded to the nearest equal-tempered
  // step. Wraps past 12 — partial 5 sits 28 semitones above the
  // fundamental, not 4.
  semitones: number;
  // True when the equal-tempered approximation differs from just intonation
  // by more than 10 cents. Currently only partial 7 (~31¢ flat of ♭7).
  tempered: boolean;
}

// log2(integer ratio) in semitones, rounded. Good enough for label use —
// the exact deviations are encoded by the tempered flag.
function semitonesAbove(ratio: number): number {
  return Math.round(12 * Math.log2(ratio));
}

export const PARTIALS: readonly Partial[] = Array.from({ length: 8 }, (_, i) => {
  const n = i + 1;
  return {
    n,
    ratio: n,
    semitones: semitonesAbove(n),
    tempered: n === 7,
  };
});

// Which partials make up the major triad living in the lower harmonic
// series — fundamental's two octaves up (4), the major third above that
// (5), and the perfect fifth above that (6). Module 1's Behold lights
// these.
export const TRIAD_PARTIALS: ReadonlySet<number> = new Set([4, 5, 6]);

// Sharp-spelled note names for the equal-tempered approximation of each
// partial, given a fundamental MIDI number. Module 1 uses MIDI 36 (C2) by
// default; the Derive section sweeps the fundamental across the octave.
const SHARP_LETTERS = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

export function midiToNoteLabel(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${SHARP_LETTERS[pc]}${octave}`;
}

export function partialMidi(fundamentalMidi: number, partial: Partial): number {
  return fundamentalMidi + partial.semitones;
}

export function partialFreq(
  fundamentalHz: number,
  partial: Partial,
): number {
  return fundamentalHz * partial.ratio;
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

// Fundamentals offered by the Module 1 Derive selector. One per scale
// degree of the C major scale, in the second octave — low enough that
// eight partials fit comfortably in the audible range without aliasing.
export interface Fundamental {
  midi: number;
  label: string;
  pc: PitchClass;
}

export const FUNDAMENTALS: readonly Fundamental[] = [
  { midi: 36, label: 'C2', pc: 0 },
  { midi: 38, label: 'D2', pc: 2 },
  { midi: 40, label: 'E2', pc: 4 },
  { midi: 41, label: 'F2', pc: 5 },
  { midi: 43, label: 'G2', pc: 7 },
  { midi: 45, label: 'A2', pc: 9 },
  { midi: 47, label: 'B2', pc: 11 },
];
