import type { Song } from '@/lib/pentimento/types';

// Working transcription of the opening four bars of a Bach-chorale-style
// phrase. Cast in C major to keep the staff free of accidentals and to line up
// with Module 0's prompt about pitch class 5 in C ("F" / "fa").
//
// The historical BWV 269 (Aus meines Herzens Grunde) is in G major; what we
// load for Module 0 is a working approximation in C, voiced soprano + bass to
// match the pentimento engraver's two-voice layout. A verified four-voice
// MusicXML import is on the to-do list, and when it arrives this file is the
// replacement target.
//
// All notes are on tier 0 — Module 0 doesn't yet need reduction layers. When
// Module 11's Schenkerian reduction comes online, this file grows additional
// tiers (foreground / middleground / background / Ursatz).

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

// Soprano line — opens on tonic, arcs up to a passing F (pc 5) which is the
// the answer to Module 0's prompt, descends through a V chord, lands on I.
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

export const BWV269: Song = {
  title: 'Aus meines Herzens Grunde (working transcription, in C)',
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
