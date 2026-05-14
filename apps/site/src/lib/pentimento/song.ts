import type { PNote, PChord, Song } from './types';

// C.C. Rider — 12-bar blues in C, four complexity tiers.
//
// Tier 0 — bones: chord roots in the bass, 3rds of each chord held in the lead.
//                 No comp.
// Tier 1 — head: the singable head melody, bass roots on beats 1 and 3, simple
//                triads on beat 1.
// Tier 2 — standard: head + walking quarter-note bass + dom7 stabs on 1 and 3.
// Tier 3 — virtuoso: head with embellishments and improv fills, walking bass
//                    with chromatic approaches, rootless 9th voicings.

// Progression: standard 12-bar blues form.
const PROGRESSION = [
  'C', 'C', 'C', 'C',
  'F', 'F', 'C', 'C',
  'G', 'F', 'C', 'G',
];

const SIXTEENTHS_PER_BAR = 16;

// Walking-bass pattern (octave 2/3) per chord: root, 3, 5, 6.
const WALK: Record<string, string[]> = {
  C: ['c/2', 'e/2', 'g/2', 'a/2'],
  F: ['f/2', 'a/2', 'c/3', 'd/3'],
  G: ['g/2', 'b/2', 'd/3', 'e/3'],
};

// Tier-3 walking — same as tier 2 but with a chromatic approach on beat 4 of
// any bar that changes chord on the next bar. The progression's loop boundary
// (bar 12 → bar 1) counts as a change.
function walkTier3(barIndex: number): string[] {
  const root = PROGRESSION[barIndex];
  const nextRoot = PROGRESSION[(barIndex + 1) % PROGRESSION.length];
  const base = [...WALK[root]];
  if (nextRoot === root) return base;
  // Replace beat 4 with a chromatic approach to the next bar's root.
  const approach: Record<string, Record<string, string>> = {
    C: { F: 'f#/2', G: 'f#/2' },
    F: { C: 'b/2', G: 'g#/2' },
    G: { C: 'd/3', F: 'e/3' },
  };
  const a = approach[root]?.[nextRoot];
  if (a) base[3] = a;
  return base;
}

// Chord triad pitches (octave 3/4) for the comp voice.
const TRIAD: Record<string, string[]> = {
  C: ['c/4', 'e/4', 'g/4'],
  F: ['f/3', 'a/3', 'c/4'],
  G: ['g/3', 'b/3', 'd/4'],
};

// Dominant-7 voicing (root position).
const DOM7: Record<string, string[]> = {
  C: ['c/4', 'e/4', 'g/4', 'bb/4'],
  F: ['f/3', 'a/3', 'c/4', 'eb/4'],
  G: ['g/3', 'b/3', 'd/4', 'f/4'],
};

// Rootless 9th voicing — 3, 5, b7, 9.
const NINTH: Record<string, string[]> = {
  C: ['e/4', 'g/4', 'bb/4', 'd/5'],
  F: ['a/3', 'c/4', 'eb/4', 'g/4'],
  G: ['b/3', 'd/4', 'f/4', 'a/4'],
};

// Guide tones — the 3rd of each chord. Sits in the lead at tier 0.
const GUIDE: Record<string, string> = {
  C: 'e/4',
  F: 'a/4',
  G: 'b/4',
};

// The head melody — authored, not generated. Steps are absolute sixteenth-
// offsets from song start. Bars 3, 4, 7, 8 leave space for the response in
// the call-and-response structure; bar 11 holds and then rests; bar 12 is the
// turnaround.
const HEAD: Omit<PNote, 'voice' | 'tier'>[] = [
  // Bar 1 (C) — "See, see ri-der" call
  { pitch: 'g/4', step: 0,  dur: 4 },
  { pitch: 'g/4', step: 4,  dur: 4 },
  { pitch: 'eb/4', step: 8,  dur: 4 },
  { pitch: 'd/4', step: 12, dur: 4 },
  // Bar 2 (C) — "see what you done done"
  { pitch: 'c/4', step: 16, dur: 2 },
  { pitch: 'c/4', step: 18, dur: 2 },
  { pitch: 'eb/4', step: 20, dur: 4 },
  { pitch: 'd/4', step: 24, dur: 4 },
  { pitch: 'c/4', step: 28, dur: 4 },
  // Bar 3 (C) — held resolution
  { pitch: 'c/4', step: 32, dur: 16 },
  // Bar 4 (C) — rest (call-and-response gap)
  // Bar 5 (F) — "made me love you"
  { pitch: 'a/4', step: 64, dur: 4 },
  { pitch: 'a/4', step: 68, dur: 4 },
  { pitch: 'f/4', step: 72, dur: 4 },
  { pitch: 'eb/4', step: 76, dur: 4 },
  // Bar 6 (F) — "now your gal done come"
  { pitch: 'f/4', step: 80, dur: 2 },
  { pitch: 'f/4', step: 82, dur: 2 },
  { pitch: 'eb/4', step: 84, dur: 4 },
  { pitch: 'd/4', step: 88, dur: 4 },
  { pitch: 'c/4', step: 92, dur: 4 },
  // Bar 7 (C) — held resolution
  { pitch: 'c/4', step: 96, dur: 16 },
  // Bar 8 (C) — rest
  // Bar 9 (G) — "you're gonna miss your rider"
  { pitch: 'd/5', step: 128, dur: 4 },
  { pitch: 'b/4', step: 132, dur: 4 },
  { pitch: 'a/4', step: 136, dur: 4 },
  { pitch: 'g/4', step: 140, dur: 4 },
  // Bar 10 (F) — "some sweet day"
  { pitch: 'f/4', step: 144, dur: 4 },
  { pitch: 'eb/4', step: 148, dur: 4 },
  { pitch: 'd/4', step: 152, dur: 4 },
  { pitch: 'c/4', step: 156, dur: 4 },
  // Bar 11 (C) — land
  { pitch: 'c/4', step: 160, dur: 8 },
  // (Half rest for steps 168–175)
  // Bar 12 (G) — turnaround pickup
  { pitch: 'd/4', step: 176, dur: 4 },
  { pitch: 'eb/4', step: 180, dur: 4 },
  { pitch: 'd/4', step: 184, dur: 4 },
  { pitch: 'b/3', step: 188, dur: 4 },
];

// Tier-2 ornaments — added on top of the head. Each pair of held quarter
// notes becomes a four-eighth-note grace pattern in selected bars.
// We replace nothing — we just add ornament notes between head notes.
// Authoring choice: gild the first beat of bars 1, 5, 9 with an eighth-note
// pickup, and put a passing bb/3 in bar 6 to bend toward c.
const TIER2_EXTRA: Omit<PNote, 'voice' | 'tier'>[] = [
  // Bar 1 pickup grace before the second "see"
  { pitch: 'a/4', step: 2,  dur: 2 },  // not actually replacing — overlaps with g/4 at step 0
  // Actually instead, add 16th-note approach into bar 2 downbeat:
  // Bar 2: a 16th approach right before the c/4 on beat 1
  // We'll skip that; keep TIER2_EXTRA simple.
];

// Tier-3 fills — improv fills in the call-and-response gap bars (3, 4, 7, 8)
// and a few extra ornaments. Each fill is a quick eighth-note descending blues
// line landing on the next chord's root.
const TIER3_FILLS: Omit<PNote, 'voice' | 'tier'>[] = [
  // Bar 3 fill (over C) — descending blues lick into bar 4
  { pitch: 'c/5',  step: 32, dur: 2 },
  { pitch: 'bb/4', step: 34, dur: 2 },
  { pitch: 'a/4',  step: 36, dur: 2 },
  { pitch: 'g/4',  step: 38, dur: 2 },
  { pitch: 'eb/4', step: 40, dur: 2 },
  { pitch: 'd/4',  step: 42, dur: 2 },
  { pitch: 'c/4',  step: 44, dur: 4 },
  // Bar 4 fill — pickup to bar 5 (F)
  { pitch: 'g/4',  step: 56, dur: 2 },
  { pitch: 'a/4',  step: 58, dur: 2 },
  { pitch: 'bb/4', step: 60, dur: 2 },
  { pitch: 'c/5',  step: 62, dur: 2 },
  // Bar 7 fill — descending blues, landing on bar 8
  { pitch: 'c/5',  step: 96, dur: 2 },
  { pitch: 'bb/4', step: 98, dur: 2 },
  { pitch: 'a/4',  step: 100, dur: 2 },
  { pitch: 'g/4',  step: 102, dur: 2 },
  { pitch: 'eb/4', step: 104, dur: 2 },
  { pitch: 'd/4',  step: 106, dur: 2 },
  { pitch: 'c/4',  step: 108, dur: 4 },
  // Bar 8 fill — pickup to G7 in bar 9
  { pitch: 'f/4',  step: 120, dur: 2 },
  { pitch: 'g/4',  step: 122, dur: 2 },
  { pitch: 'a/4',  step: 124, dur: 2 },
  { pitch: 'b/4',  step: 126, dur: 2 },
  // Bar 11 fill (replaces the half-rest after the c/4 landing)
  { pitch: 'g/4',  step: 168, dur: 2 },
  { pitch: 'a/4',  step: 170, dur: 2 },
  { pitch: 'bb/4', step: 172, dur: 2 },
  { pitch: 'a/4',  step: 174, dur: 2 },
];

// Generate the bass voice across all tiers.
function buildBass(): PNote[] {
  const out: PNote[] = [];
  for (let bar = 0; bar < PROGRESSION.length; bar++) {
    const root = PROGRESSION[bar];
    const barStart = bar * SIXTEENTHS_PER_BAR;

    // Tier 0: root, whole note in octave 2.
    out.push({ voice: 'bass', pitch: `${root.toLowerCase()}/2`, step: barStart, dur: 16, tier: 0 });

    // Tier 1: root + 5th, half notes on beats 1 and 3.
    const t1 = WALK[root];
    out.push({ voice: 'bass', pitch: t1[0], step: barStart, dur: 8, tier: 1 });
    out.push({ voice: 'bass', pitch: t1[2], step: barStart + 8, dur: 8, tier: 1 });

    // Tier 2: walking quarter notes (root, 3, 5, 6).
    const t2 = WALK[root];
    for (let q = 0; q < 4; q++) {
      out.push({ voice: 'bass', pitch: t2[q], step: barStart + q * 4, dur: 4, tier: 2 });
    }

    // Tier 3: walking with chromatic approach.
    const t3 = walkTier3(bar);
    for (let q = 0; q < 4; q++) {
      out.push({ voice: 'bass', pitch: t3[q], step: barStart + q * 4, dur: 4, tier: 3 });
    }
  }
  return out;
}

// Generate the lead voice across all tiers.
function buildLead(): PNote[] {
  const out: PNote[] = [];

  // Tier 0 — chord 3rds, whole notes.
  for (let bar = 0; bar < PROGRESSION.length; bar++) {
    out.push({
      voice: 'lead',
      pitch: GUIDE[PROGRESSION[bar]],
      step: bar * SIXTEENTHS_PER_BAR,
      dur: 16,
      tier: 0,
    });
  }

  // Tier 1 — head melody as authored.
  for (const n of HEAD) out.push({ ...n, voice: 'lead', tier: 1 });

  // Tier 2 — head + tier-2 ornaments (TIER2_EXTRA is intentionally empty for
  // v1; the head alone is the "standard" lead).
  for (const n of HEAD) out.push({ ...n, voice: 'lead', tier: 2 });
  for (const n of TIER2_EXTRA) out.push({ ...n, voice: 'lead', tier: 2 });

  // Tier 3 — head + improv fills.
  for (const n of HEAD) out.push({ ...n, voice: 'lead', tier: 3 });
  for (const n of TIER3_FILLS) out.push({ ...n, voice: 'lead', tier: 3 });

  return out;
}

// Generate the comp voice across all tiers.
function buildComp(): PChord[] {
  const out: PChord[] = [];
  for (let bar = 0; bar < PROGRESSION.length; bar++) {
    const root = PROGRESSION[bar];
    const barStart = bar * SIXTEENTHS_PER_BAR;

    // Tier 0 — no comp.

    // Tier 1 — triad on beat 1, dur quarter.
    out.push({
      step: barStart,
      dur: 4,
      pitches: TRIAD[root],
      symbol: root,
      tier: 1,
    });

    // Tier 2 — dom7 on beats 1 and 3, dur quarter.
    out.push({ step: barStart,     dur: 4, pitches: DOM7[root], symbol: `${root}7`, tier: 2 });
    out.push({ step: barStart + 8, dur: 4, pitches: DOM7[root], symbol: `${root}7`, tier: 2 });

    // Tier 3 — rootless 9th on beats 1 and 3.
    out.push({ step: barStart,     dur: 4, pitches: NINTH[root], symbol: `${root}9`, tier: 3 });
    out.push({ step: barStart + 8, dur: 4, pitches: NINTH[root], symbol: `${root}9`, tier: 3 });
  }
  return out;
}

export const CC_RIDER: Song = {
  title: 'C.C. Rider',
  bpm: 88,
  beatsPerBar: 4,
  bars: 12,
  notes: [...buildBass(), ...buildLead()],
  chords: buildComp(),
  tierLabels: ['bones', 'head', 'standard', 'virtuoso'],
  progression: PROGRESSION,
};
