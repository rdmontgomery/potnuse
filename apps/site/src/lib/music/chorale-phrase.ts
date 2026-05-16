import type { Song } from '@/lib/pentimento/types';

// Working chorale phrase — four bars in C major, soprano + bass voicing,
// composed to match the pentimento engraver's two-voice layout. This is
// NOT a transcription of a specific Bach chorale; it's a stand-in that
// lets every module above Module 0 run its lens over a consistent
// example.
//
// When a verified MusicXML import of an actual chorale (BWV 269,
// "Aus meines Herzens Grunde", is the leading candidate) lands, this
// file is the replacement target. All callers reach for CHORALE_PHRASE
// rather than the historical title so the swap is contained.
//
// All notes are on tier 0 — until Module 11's Schenkerian reduction
// comes online, no separate reduction tiers are authored. Once it does,
// this file grows additional tiers (foreground / middleground /
// background / Ursatz).

// Step value = sixteenth-note position from bar 0, beat 1. q = 4 steps,
// h = 8 steps, w = 16 steps.
const Q = 4;
const H = 8;
const W = 16;

interface RawNote {
  pitch: string;
  step: number;
  dur: number;
}

// Soprano line — opens on tonic, arcs up to a passing F (pc 5) which is
// the answer to Module 0's prompt, descends through a V chord, lands on
// I.
const SOPRANO: RawNote[] = [
  // Bar 1 — c arpeggio, half + two quarters
  { pitch: 'c/4', step: 0, dur: H },
  { pitch: 'e/4', step: H, dur: Q },
  { pitch: 'g/4', step: H + Q, dur: Q },
  // Bar 2 — reach to F, gentle descent
  { pitch: 'f/4', step: W, dur: H },
  { pitch: 'e/4', step: W + H, dur: Q },
  { pitch: 'd/4', step: W + H + Q, dur: Q },
  // Bar 3 — diatonic scale degrees 1-2-3-4 walk up
  { pitch: 'c/4', step: 2 * W, dur: Q },
  { pitch: 'd/4', step: 2 * W + Q, dur: Q },
  { pitch: 'e/4', step: 2 * W + 2 * Q, dur: Q },
  { pitch: 'f/4', step: 2 * W + 3 * Q, dur: Q },
  // Bar 4 — authentic cadence: 3-2-7-1
  { pitch: 'e/4', step: 3 * W, dur: Q },
  { pitch: 'd/4', step: 3 * W + Q, dur: Q },
  { pitch: 'b/3', step: 3 * W + 2 * Q, dur: Q },
  { pitch: 'c/4', step: 3 * W + 3 * Q, dur: Q },
];

// Bass line — chordal roots beneath each bar. I — IV — I / V — V — I.
const BASS: RawNote[] = [
  // Bar 1 — I
  { pitch: 'c/3', step: 0, dur: W },
  // Bar 2 — IV
  { pitch: 'f/2', step: W, dur: W },
  // Bar 3 — I to V
  { pitch: 'c/3', step: 2 * W, dur: H },
  { pitch: 'g/2', step: 2 * W + H, dur: H },
  // Bar 4 — V to I
  { pitch: 'g/2', step: 3 * W, dur: H },
  { pitch: 'c/3', step: 3 * W + H, dur: H },
];

export const CHORALE_PHRASE: Song = {
  title: 'working chorale phrase, in C major',
  bpm: 72,
  beatsPerBar: 4,
  bars: 4,
  notes: [
    ...SOPRANO.map((n) => ({ ...n, voice: 'lead' as const, tier: 0 })),
    ...BASS.map((n) => ({ ...n, voice: 'bass' as const, tier: 0 })),
  ],
  chords: [],
  tierLabels: ['surface'],
  progression: ['C', 'F', 'C', 'G'],
};
