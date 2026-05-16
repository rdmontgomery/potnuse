// Module 4 — triads stacked tertianly from each scale degree. In a major
// key the qualities run M-m-m-M-M-m-dim (the I, ii, iii, IV, V, vi, vii°
// sequence). Stacking by thirds within the diatonic gap pattern is what
// produces this fixed quality pattern; the Roman numerals just name the
// position.

import { C_MAJOR_PCS } from './diatonic';
import { mod12, type PitchClass } from './pitchClass';

export type Quality = 'major' | 'minor' | 'diminished' | 'augmented';

export const ROMAN_NUMERALS: readonly string[] = [
  'I',
  'ii',
  'iii',
  'IV',
  'V',
  'vi',
  'vii°',
];

export const MAJOR_TRIAD_QUALITIES: readonly Quality[] = [
  'major',
  'minor',
  'minor',
  'major',
  'major',
  'minor',
  'diminished',
];

export const QUALITY_LABEL: Record<Quality, string> = {
  major: 'major',
  minor: 'minor',
  diminished: 'diminished',
  augmented: 'augmented',
};

function wrap7(degree: number): number {
  return ((degree % 7) + 7) % 7;
}

// PCs of the triad stacked tertianly from the d-th scale degree of C
// major. Stride is two scale degrees per stack (root → third → fifth).
export function diatonicTriadPcs(degree: number): PitchClass[] {
  const d = wrap7(degree);
  return [
    C_MAJOR_PCS[d],
    C_MAJOR_PCS[(d + 2) % 7],
    C_MAJOR_PCS[(d + 4) % 7],
  ];
}

export function triadQuality(degree: number): Quality {
  return MAJOR_TRIAD_QUALITIES[wrap7(degree)];
}

export function romanFor(degree: number): string {
  return ROMAN_NUMERALS[wrap7(degree)];
}

// Intervals (in semitones) of the third and fifth above the root, given
// the triad quality. Used to build a close-voicing MIDI chord that
// matches a given root pitch.
export function triadIntervals(quality: Quality): [number, number] {
  switch (quality) {
    case 'major':
      return [4, 7];
    case 'minor':
      return [3, 7];
    case 'diminished':
      return [3, 6];
    case 'augmented':
      return [4, 8];
  }
}

// MIDI pitches of the diatonic triad at the given degree, voiced close
// from a root in the C4 octave. Returns root, third, fifth — each in
// ascending order so the chord plays as written.
export function diatonicTriadMidi(
  degree: number,
  baseRootMidi: number = 60,
): [number, number, number] {
  const pcs = diatonicTriadPcs(degree);
  const root = baseRootMidi + pcs[0];
  const [t3, t5] = triadIntervals(triadQuality(degree));
  return [root, root + t3, root + t5];
}

// Two stock progressions used by Module 4's Operate. Numbers are
// scale-degree indices (0 = I, … 6 = vii°).
export const PROGRESSION_I_IV_V_I: readonly number[] = [0, 3, 4, 0];
export const PROGRESSION_I_VI_IV_V: readonly number[] = [0, 5, 3, 4];

// Re-export so callers don't need to import from two files.
export { mod12 };
