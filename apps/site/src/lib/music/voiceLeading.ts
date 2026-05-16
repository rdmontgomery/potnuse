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

// --- 2-voice orbifold (Möbius strip) -----------------------------------
//
// The space of unordered pairs of pitches, T^2 / S_2, is a Möbius
// strip — Tymoczko's classic intro example. We use a fundamental
// domain {(x, y) ∈ [0, 12]^2 : x ≤ y}: a right triangle whose
// hypotenuse is the "unison wall" (x = y, both voices on the same
// pitch). Voice leadings between two dyads are paths in this
// triangle. Crossing voices reflects off the wall.
//
// We work with continuous pitches in [0, 12] rather than discrete pcs
// so the geometric reflection point lands somewhere meaningful even
// when the input dyads happen to have integer-spaced voices.

export interface Dyad {
  a: number; // lower voice, in [0, 12)
  b: number; // upper voice, in [a, 12)
}

export function makeDyad(p: number, q: number): Dyad {
  const x = ((p % 12) + 12) % 12;
  const y = ((q % 12) + 12) % 12;
  return x <= y ? { a: x, b: y } : { a: y, b: x };
}

export interface DyadVoiceLeading {
  // 'parallel' = each voice goes to its same-position partner;
  // 'crossed' = voices cross, reflecting off the unison wall.
  kind: 'parallel' | 'crossed';
  cost: number;
  // For 'crossed' paths, the reflection point on the unison wall,
  // in (x, y) where x = y. Caller renders the path as two
  // segments: from → wall → to.
  reflection?: { p: number };
}

// Minimum-cost voice leading between two dyads, treating each voice's
// motion as the unsigned linear (NOT pc-circular) distance within the
// shared fundamental domain. For a continuous orbifold demo this is
// the right metric — pc-wraparound complicates the picture and is
// handled separately in minimalVoiceLeading above.
export function dyadVoiceLeading(from: Dyad, to: Dyad): DyadVoiceLeading {
  const parallelCost = Math.abs(to.a - from.a) + Math.abs(to.b - from.b);
  // "Crossed" sends from.a → to.b and from.b → to.a. The path passes
  // through the unison wall at the pitch where the two voices coincide.
  const crossedCost = Math.abs(to.b - from.a) + Math.abs(to.a - from.b);

  if (parallelCost <= crossedCost) {
    return { kind: 'parallel', cost: parallelCost };
  }

  // Parametrize each voice as p_i(t) = from_i + t * (target_i - from_i)
  // for t ∈ [0, 1] with target_1 = to.b, target_2 = to.a (the crossed
  // assignment). They coincide when:
  //   from.a + t * (to.b - from.a) = from.b + t * (to.a - from.b)
  //   t * ((to.b - from.a) - (to.a - from.b)) = from.b - from.a
  //   t = (from.b - from.a) / ((to.b - to.a) + (from.b - from.a))
  const denom = (to.b - to.a) + (from.b - from.a);
  const t = denom !== 0 ? (from.b - from.a) / denom : 0.5;
  const p = from.a + t * (to.b - from.a);
  return { kind: 'crossed', cost: crossedCost, reflection: { p } };
}
