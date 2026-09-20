// Module 10 — Schenkerian reduction. Heinrich Schenker's analytic
// claim: tonal music has a deep structural skeleton (the Ursatz) which
// the surface elaborates through prolongation. Reductions strip the
// elaborations away in layers — foreground, middleground, background,
// finally the Ursatz itself.
//
// Authored here as four Song objects, each rendering the four-bar
// chorale phrase at a different depth. Module 10 binds the spine's
// tier slider to these so the listener can scrub through the layers
// and see what counts as structural versus elaboration.

import type { Song, PNote } from '@/lib/pentimento/types';

// Step value = sixteenth-note position. q = 4, h = 8, w = 16.
const Q = 4;
const H = 8;
const W = 16;

interface Raw {
  pitch: string;
  step: number;
  dur: number;
  voice: 'lead' | 'bass';
}

function toNotes(raws: Raw[]): PNote[] {
  return raws.map((r) => ({
    pitch: r.pitch,
    step: r.step,
    dur: r.dur,
    voice: r.voice,
    tier: 0,
  }));
}

function makeSong(title: string, raws: Raw[]): Song {
  return {
    title,
    bpm: 72,
    beatsPerBar: 4,
    bars: 4,
    notes: toNotes(raws),
    chords: [],
    tierLabels: [title],
    progression: ['C', 'F', 'C', 'G'],
  };
}

// Foreground — every authored note. Identical to chorale-phrase.ts
// but kept self-contained so the Schenker module reads start-to-finish
// without external dependencies. Diverging in the future (a different
// foreground exposition for analysis) won't ripple into other modules.
const FOREGROUND_RAWS: Raw[] = [
  // Soprano
  { pitch: 'c/4', step: 0, dur: H, voice: 'lead' },
  { pitch: 'e/4', step: H, dur: Q, voice: 'lead' },
  { pitch: 'g/4', step: H + Q, dur: Q, voice: 'lead' },
  { pitch: 'f/4', step: W, dur: H, voice: 'lead' },
  { pitch: 'e/4', step: W + H, dur: Q, voice: 'lead' },
  { pitch: 'd/4', step: W + H + Q, dur: Q, voice: 'lead' },
  { pitch: 'c/4', step: 2 * W, dur: Q, voice: 'lead' },
  { pitch: 'd/4', step: 2 * W + Q, dur: Q, voice: 'lead' },
  { pitch: 'e/4', step: 2 * W + 2 * Q, dur: Q, voice: 'lead' },
  { pitch: 'f/4', step: 2 * W + 3 * Q, dur: Q, voice: 'lead' },
  { pitch: 'e/4', step: 3 * W, dur: Q, voice: 'lead' },
  { pitch: 'd/4', step: 3 * W + Q, dur: Q, voice: 'lead' },
  { pitch: 'b/3', step: 3 * W + 2 * Q, dur: Q, voice: 'lead' },
  { pitch: 'c/4', step: 3 * W + 3 * Q, dur: Q, voice: 'lead' },
  // Bass
  { pitch: 'c/3', step: 0, dur: W, voice: 'bass' },
  { pitch: 'f/2', step: W, dur: W, voice: 'bass' },
  { pitch: 'c/3', step: 2 * W, dur: H, voice: 'bass' },
  { pitch: 'g/2', step: 2 * W + H, dur: H, voice: 'bass' },
  { pitch: 'g/2', step: 3 * W, dur: H, voice: 'bass' },
  { pitch: 'c/3', step: 3 * W + H, dur: H, voice: 'bass' },
];

// Middleground — drop the inner passing tones; keep one chord tone
// per beat in the soprano, full bass.
const MIDDLEGROUND_RAWS: Raw[] = [
  // Soprano: keep the structural notes per bar
  { pitch: 'c/4', step: 0, dur: H, voice: 'lead' },
  { pitch: 'e/4', step: H, dur: H, voice: 'lead' },
  { pitch: 'f/4', step: W, dur: H, voice: 'lead' },
  { pitch: 'd/4', step: W + H, dur: H, voice: 'lead' },
  { pitch: 'c/4', step: 2 * W, dur: H, voice: 'lead' },
  { pitch: 'e/4', step: 2 * W + H, dur: H, voice: 'lead' },
  { pitch: 'd/4', step: 3 * W, dur: H, voice: 'lead' },
  { pitch: 'c/4', step: 3 * W + H, dur: H, voice: 'lead' },
  // Bass: same as foreground
  { pitch: 'c/3', step: 0, dur: W, voice: 'bass' },
  { pitch: 'f/2', step: W, dur: W, voice: 'bass' },
  { pitch: 'c/3', step: 2 * W, dur: H, voice: 'bass' },
  { pitch: 'g/2', step: 2 * W + H, dur: H, voice: 'bass' },
  { pitch: 'g/2', step: 3 * W, dur: H, voice: 'bass' },
  { pitch: 'c/3', step: 3 * W + H, dur: H, voice: 'bass' },
];

// Background — one structural soprano note per bar, paired with
// the bass arpeggiation through I, IV, I/V, V/I.
const BACKGROUND_RAWS: Raw[] = [
  { pitch: 'e/4', step: 0, dur: W, voice: 'lead' },
  { pitch: 'f/4', step: W, dur: W, voice: 'lead' },
  { pitch: 'd/4', step: 2 * W, dur: W, voice: 'lead' },
  { pitch: 'c/4', step: 3 * W, dur: W, voice: 'lead' },
  { pitch: 'c/3', step: 0, dur: W, voice: 'bass' },
  { pitch: 'f/2', step: W, dur: W, voice: 'bass' },
  { pitch: 'g/2', step: 2 * W, dur: W, voice: 'bass' },
  { pitch: 'c/3', step: 3 * W, dur: W, voice: 'bass' },
];

// Ursatz — the deep structural skeleton. A 3-line Urlinie (3-2-1
// descent in the soprano: E, D, C) over a I-V-I Bassbrechung (C, G,
// C in the bass). Three soprano notes, three bass notes, one phrase
// reduced to its skeleton.
const URSATZ_RAWS: Raw[] = [
  { pitch: 'e/4', step: 0, dur: 2 * W, voice: 'lead' },
  { pitch: 'd/4', step: 2 * W, dur: W, voice: 'lead' },
  { pitch: 'c/4', step: 3 * W, dur: W, voice: 'lead' },
  { pitch: 'c/3', step: 0, dur: 2 * W, voice: 'bass' },
  { pitch: 'g/2', step: 2 * W, dur: W, voice: 'bass' },
  { pitch: 'c/3', step: 3 * W, dur: W, voice: 'bass' },
];

export const SCHENKER_TIERS = [
  { id: 'foreground', label: 'foreground', song: makeSong('foreground', FOREGROUND_RAWS) },
  { id: 'middleground', label: 'middleground', song: makeSong('middleground', MIDDLEGROUND_RAWS) },
  { id: 'background', label: 'background', song: makeSong('background', BACKGROUND_RAWS) },
  { id: 'ursatz', label: 'Ursatz', song: makeSong('Ursatz', URSATZ_RAWS) },
] as const;

export type SchenkerTierId = (typeof SCHENKER_TIERS)[number]['id'];
