// Module 8 — voice leading as geodesic motion. Tymoczko's claim, in one
// sentence: the shortest path between two chords in the orbifold space
// T^n/S_n equals the minimal voice leading between them — the assignment
// of source-voices to target-voices that minimizes the total semitone
// motion.
//
// The full orbifold (a 3D quotient space with branching cuts for
// triads) is hard to visualize, so this module's interactives focus on
// the consequence: compute the minimal voice leading for any pair of
// chords, and notice that the moves PLR generated in Module 7 are all
// minimal-motion of cost 1 — the very edges of the orbifold.

import { mod12, type PitchClass } from './pitchClass';

export interface VoiceMove {
  from: PitchClass;
  to: PitchClass;
  // Signed semitone distance, in the range [-6, 6]. Positive means
  // upward motion, negative downward — whichever is shortest on the
  // pitch-class circle.
  motion: number;
}

export interface VoiceLeading {
  moves: VoiceMove[];
  totalMotion: number;
}

// Shortest distance between two pcs on the chromatic circle, signed so
// the caller can render the direction. Ties (distance 6) resolve as a
// positive motion.
function shortestMotion(from: PitchClass, to: PitchClass): number {
  let d = mod12(to - from);
  if (d > 6) d -= 12;
  return d;
}

function* permutations<T>(arr: readonly T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield [...arr];
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const r of permutations(rest)) {
      yield [arr[i], ...r];
    }
  }
}

// Enumerate every permutation of `to` and pick the one that minimizes
// total motion. For 3-voice chords this is 6 candidates — easy enough
// to brute-force. For larger n this would want a Hungarian-algorithm
// pass, but the curriculum only deals with triads.
export function minimalVoiceLeading(
  from: readonly PitchClass[],
  to: readonly PitchClass[],
): VoiceLeading {
  if (from.length !== to.length) {
    throw new Error('voice leading requires same-cardinality chords');
  }
  let best: VoiceLeading | null = null;
  for (const perm of permutations(to)) {
    const moves: VoiceMove[] = from.map((f, i) => ({
      from: f,
      to: perm[i],
      motion: shortestMotion(f, perm[i]),
    }));
    const totalMotion = moves.reduce((s, m) => s + Math.abs(m.motion), 0);
    if (!best || totalMotion < best.totalMotion) {
      best = { moves, totalMotion };
    }
  }
  return best!;
}
