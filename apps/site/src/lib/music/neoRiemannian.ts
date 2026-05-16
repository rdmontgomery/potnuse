// Module 7 — neo-Riemannian P, L, R transformations between consonant
// (major and minor) triads. Each transformation is an involution (apply
// twice to return to start) and moves the triad by a single voice
// leading: two pitches stay, one moves by a half or whole step.
//
//   P (Parallel): major ↔ minor on the same root. C ↔ Cm.
//   L (Leading-tone exchange): C ↔ Em. Root moves up a major third,
//     quality flips. Shares E and G with C major.
//   R (Relative): C ↔ Am. Root moves up a major sixth (or down a
//     minor third), quality flips. Shares C and E with C major.
//
// Composing these gives the PLR group, the engine behind Riemann's
// nineteenth-century analysis of chromatic chord motion in late
// Romantic music. Three involutions on 24 consonant triads — a
// surprisingly rich structure for so few rules.

import { PITCH_NAMES, mod12, type PitchClass } from './pitchClass';

export type TriadQuality = 'major' | 'minor';

export interface Triad {
  root: PitchClass;
  quality: TriadQuality;
}

export type PLR = 'P' | 'L' | 'R';

export function triadPcs(t: Triad): [PitchClass, PitchClass, PitchClass] {
  const third = t.quality === 'major' ? 4 : 3;
  return [t.root, mod12(t.root + third), mod12(t.root + 7)];
}

// Close-voiced MIDI triad in the C4 register so the listener hears
// each PLR step land near where the previous one did. Allow the root
// to wrap above C5 if it pushes higher.
export function triadMidi(
  t: Triad,
  baseOctaveMidi: number = 60,
): [number, number, number] {
  const third = t.quality === 'major' ? 4 : 3;
  return [baseOctaveMidi + t.root, baseOctaveMidi + t.root + third, baseOctaveMidi + t.root + 7];
}

export function triadName(t: Triad): string {
  const r = PITCH_NAMES[t.root];
  return t.quality === 'major' ? r : `${r}m`;
}

export function applyP(t: Triad): Triad {
  return {
    root: t.root,
    quality: t.quality === 'major' ? 'minor' : 'major',
  };
}

export function applyL(t: Triad): Triad {
  if (t.quality === 'major') {
    return { root: mod12(t.root + 4), quality: 'minor' };
  }
  return { root: mod12(t.root + 8), quality: 'major' };
}

export function applyR(t: Triad): Triad {
  if (t.quality === 'major') {
    return { root: mod12(t.root + 9), quality: 'minor' };
  }
  return { root: mod12(t.root + 3), quality: 'major' };
}

export function apply(t: Triad, op: PLR): Triad {
  switch (op) {
    case 'P':
      return applyP(t);
    case 'L':
      return applyL(t);
    case 'R':
      return applyR(t);
  }
}

// Which pcs are shared between t and apply(t, op). Always two of the
// three — the one that moves is the "voice leading" of the
// transformation. Useful for the visualization that highlights the
// stationary tones.
export function sharedPcs(t: Triad, op: PLR): PitchClass[] {
  const a = new Set(triadPcs(t));
  const b = triadPcs(apply(t, op));
  return b.filter((pc) => a.has(pc));
}
