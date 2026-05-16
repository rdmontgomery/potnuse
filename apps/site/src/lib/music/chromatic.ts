// Module 6 — chromatic harmony as borrowing. Two main vocabularies sit
// at the heart of nineteenth-century tonality:
//
//   1. Secondary dominants — temporarily treating any diatonic chord
//      as a local tonic, by inserting its own dominant (V) in front.
//      Notation: V/X reads "the dominant of X."
//
//   2. Modal mixture — borrowing chords from the parallel minor key.
//      In C major, the parallel minor is C minor; that scale supplies
//      iv (minor), ♭VI, ♭III, ♭VII, and the "tragic" i. The borrowed
//      chord injects the parallel mode's color into the major-key
//      surroundings.
//
// Both are deviations from the diatonic set Module 3 derived. The
// curriculum's underlying claim is that they're not random additions
// — each borrowed chord points somewhere, and the pull is what makes
// chromatic music move.

import type { PitchClass } from './pitchClass';

export type Origin = 'tonicization' | 'mixture' | 'neapolitan';
export type Quality = 'major' | 'minor' | 'diminished' | 'dominant7';

export interface ChromaticChord {
  id: string;
  label: string;
  longLabel: string;
  // Pitch classes of the chord. Root first, then third, then fifth.
  // For dominant-7 chords, the seventh follows.
  pcs: readonly PitchClass[];
  // VexFlow keys, close-voiced near middle C, for ChordStaff display.
  vexKeys: readonly string[];
  quality: Quality;
  rootPc: PitchClass;
  origin: Origin;
  // For tonicizations only: which diatonic scale degree this chord
  // resolves into. 0 = I, 3 = IV, 4 = V, 5 = vi, 1 = ii.
  resolvesTo?: number;
  // One-line pedagogical hook surfaced in Derive.
  blurb: string;
}

export const CHROMATIC_CHORDS: readonly ChromaticChord[] = [
  // --- Secondary dominants ---------------------------------------------
  {
    id: 'V-of-V',
    label: 'V/V',
    longLabel: 'dominant of V',
    pcs: [2, 6, 9], // D F# A
    vexKeys: ['d/4', 'f#/4', 'a/4'],
    quality: 'major',
    rootPc: 2,
    origin: 'tonicization',
    resolvesTo: 4,
    blurb:
      'D major pulls toward G (the V). The F♯ is the new leading-tone — borrowed evidence that we\'re briefly visiting the key of G.',
  },
  {
    id: 'V-of-vi',
    label: 'V/vi',
    longLabel: 'dominant of vi',
    pcs: [4, 8, 11], // E G# B
    vexKeys: ['e/4', 'g#/4', 'b/4'],
    quality: 'major',
    rootPc: 4,
    origin: 'tonicization',
    resolvesTo: 5,
    blurb:
      'E major pulls toward A minor (vi). The G♯ is the leading-tone of A — the same mechanism, one node over.',
  },
  {
    id: 'V-of-ii',
    label: 'V/ii',
    longLabel: 'dominant of ii',
    pcs: [9, 1, 4], // A C# E
    vexKeys: ['a/3', 'c#/4', 'e/4'],
    quality: 'major',
    rootPc: 9,
    origin: 'tonicization',
    resolvesTo: 1,
    blurb:
      'A major leans toward D minor (ii). Useful when the next chord is a ii on its way to V — a long-line tonicization through the predominant.',
  },

  // --- Modal mixture ---------------------------------------------------
  {
    id: 'iv-borrowed',
    label: 'iv',
    longLabel: 'minor iv (borrowed from parallel minor)',
    pcs: [5, 8, 0], // F Ab C
    vexKeys: ['f/4', 'a♭/4', 'c/5'],
    quality: 'minor',
    rootPc: 5,
    origin: 'mixture',
    blurb:
      'F minor in place of F major. The A♭ is borrowed from C minor; it lowers the chord\'s color without leaving the key.',
  },
  {
    id: 'bVI',
    label: '♭VI',
    longLabel: 'flat-six (borrowed from parallel minor)',
    pcs: [8, 0, 3], // Ab C Eb
    vexKeys: ['a♭/3', 'c/4', 'e♭/4'],
    quality: 'major',
    rootPc: 8,
    origin: 'mixture',
    blurb:
      'A♭ major in C. A major chord on a flat scale degree — pure mixture color. Often resolves outward to V or back to I.',
  },
  {
    id: 'bVII',
    label: '♭VII',
    longLabel: 'flat-seven (borrowed from parallel minor)',
    pcs: [10, 2, 5], // Bb D F
    vexKeys: ['b♭/3', 'd/4', 'f/4'],
    quality: 'major',
    rootPc: 10,
    origin: 'mixture',
    blurb:
      'B♭ major in C. Sounds like a rock-and-roll IV-of-IV. The B♭ in place of B sidesteps the usual leading-tone pull.',
  },

  // --- Neapolitan ------------------------------------------------------
  {
    id: 'N6',
    label: '♭II⁶',
    longLabel: 'Neapolitan sixth',
    pcs: [1, 5, 8], // Db F Ab
    vexKeys: ['f/4', 'a♭/4', 'd♭/5'],
    quality: 'major',
    rootPc: 1,
    origin: 'neapolitan',
    blurb:
      'D♭ major in first inversion. A predominant heavyweight — typically lands on V before V resolves to I. Both the D♭ and A♭ are borrowed.',
  },
];
