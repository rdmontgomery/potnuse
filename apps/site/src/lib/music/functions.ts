// Module 5 — harmonic function. Each diatonic triad falls into one of
// three roles: tonic, predominant, dominant. The standard local
// progression T → PD → D → T is the tension arc most pop, classical,
// and folk music traverses. Cadences are the closing two-chord
// gestures: V → I (authentic), IV → I (plagal), V → vi (deceptive),
// anything → V (half).

export type Fn = 'tonic' | 'predominant' | 'dominant';

// Function each diatonic scale degree fills in a major key.
// 0-indexed: I, ii, iii, IV, V, vi, vii°.
export const FUNCTION_OF_DEGREE: readonly Fn[] = [
  'tonic',
  'predominant',
  'tonic',
  'predominant',
  'dominant',
  'tonic',
  'dominant',
];

export const FUNCTION_LABEL: Record<Fn, string> = {
  tonic: 'tonic',
  predominant: 'predominant',
  dominant: 'dominant',
};

export const FUNCTION_SHORT: Record<Fn, string> = {
  tonic: 'T',
  predominant: 'PD',
  dominant: 'D',
};

// Scale degrees serving each function (0-indexed). Order is the most
// "central" chord first (I before iii/vi, IV before ii, V before vii°).
export const CHORDS_BY_FUNCTION: Record<Fn, readonly number[]> = {
  tonic: [0, 5, 2],
  predominant: [3, 1],
  dominant: [4, 6],
};

// One-line color text per function — surfaced in Derive captions so the
// listener has a feel for what the role *does*, not just which chords
// fill it.
export const FUNCTION_BLURB: Record<Fn, string> = {
  tonic: 'home. The chord the music wants to return to.',
  predominant: 'pull away from home. Sets up the dominant.',
  dominant: 'leaning back toward home. Wants to resolve.',
};

// The canonical T-PD-D-T cycle. Behold animates this; Operate defaults
// to it and lets the user swap each slot for a function-equivalent
// substitution.
export const T_PD_D_T: readonly { degree: number; fn: Fn }[] = [
  { degree: 0, fn: 'tonic' },
  { degree: 3, fn: 'predominant' },
  { degree: 4, fn: 'dominant' },
  { degree: 0, fn: 'tonic' },
];
