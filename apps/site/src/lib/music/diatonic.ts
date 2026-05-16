// Module 3 — the diatonic scale as a 7-subset of Z_12. The gap pattern
// 2-2-1-2-2-2-1 is the maximally even distribution of seven elements in
// twelve positions: the variance of consecutive-gap sizes is the smallest
// achievable for any 7-subset, and that minimum is achieved by exactly
// one set up to transposition. Modes are rotations of this gap pattern,
// each anchored to a different scale degree as the tonic.

import { mod12, type PitchClass } from './pitchClass';

// Gaps between consecutive scale degrees of major, walking up.
export const DIATONIC_GAPS: readonly number[] = [2, 2, 1, 2, 2, 2, 1];

// Pitch classes of C major. Other major keys are transpositions of this
// set; the gap pattern is invariant.
export const C_MAJOR_PCS: readonly PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

export const MODE_NAMES: readonly string[] = [
  'Ionian',
  'Dorian',
  'Phrygian',
  'Lydian',
  'Mixolydian',
  'Aeolian',
  'Locrian',
];

// Tonic of the mode built on the n-th scale degree of C major.
// degree 0 → C (Ionian), 1 → D (Dorian), …, 6 → B (Locrian).
export function modeTonic(degree: number): PitchClass {
  const d = ((degree % 7) + 7) % 7;
  return C_MAJOR_PCS[d];
}

// Gap pattern of the mode at the given degree — rotation of
// DIATONIC_GAPS so the gaps walk from the new tonic upward.
export function modeGaps(degree: number): number[] {
  const d = ((degree % 7) + 7) % 7;
  return [...DIATONIC_GAPS.slice(d), ...DIATONIC_GAPS.slice(0, d)];
}

// Pcs of the mode, starting on its tonic and walking up by the rotated
// gap pattern.
export function modePcs(degree: number): PitchClass[] {
  const gaps = modeGaps(degree);
  const out: PitchClass[] = [modeTonic(degree)];
  let pc: PitchClass = out[0];
  // Take all gaps but the last — the last would wrap back to the
  // octave-equivalent tonic, which is already counted.
  for (let i = 0; i < gaps.length - 1; i++) {
    pc = mod12(pc + gaps[i]);
    out.push(pc);
  }
  return out;
}

// Ascending scale as MIDI numbers, starting on the given MIDI tonic and
// walking up the mode's full gap pattern. Length is 8 (tonic plus seven
// gaps closing on the octave).
export function modeMidiAscending(
  degree: number,
  tonicMidi: number,
): number[] {
  const gaps = modeGaps(degree);
  const out: number[] = [tonicMidi];
  let m = tonicMidi;
  for (const g of gaps) {
    m += g;
    out.push(m);
  }
  return out;
}
