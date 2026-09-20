// Z_12 — the equal-tempered group. Pitch classes 0..11 with C = 0.
//
// Octave equivalence collapses all C's onto the same pitch class. This file is
// the smallest set of utilities Module 0 needs: naming, transposition,
// inversion, and one parser that turns a VexFlow-style pitch string into a
// pitch class.

export type PitchClass = number;

// Sharp spellings. We could pick flat names too; for pedagogy in Module 0 the
// numeric labels do most of the work and the letter names are an alternate
// face on the same Z_12 element.
export const PITCH_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

// Movable-do solfege over C major. Used for the prompt that accepts
// "F" or "fa" as the name of pitch class 5 in C.
const C_MAJOR_SOLFEGE: Record<PitchClass, string> = {
  0: 'do',
  2: 're',
  4: 'mi',
  5: 'fa',
  7: 'sol',
  9: 'la',
  11: 'ti',
};

export function mod12(n: number): PitchClass {
  return ((n % 12) + 12) % 12;
}

const LETTER_TO_PC: Record<string, PitchClass> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

// "c/4" -> 0, "eb/3" -> 3, "f#/5" -> 6.
export function pitchClassOf(vexPitch: string): PitchClass {
  const head = vexPitch.split('/')[0];
  const letter = head[0].toLowerCase();
  let pc = LETTER_TO_PC[letter];
  if (pc === undefined) {
    throw new Error(`unknown pitch letter: ${head}`);
  }
  for (let i = 1; i < head.length; i++) {
    const a = head[i];
    if (a === '#') pc += 1;
    else if (a === 'b') pc -= 1;
  }
  return mod12(pc);
}

export function transpose(pc: PitchClass, n: number): PitchClass {
  return mod12(pc + n);
}

export function transposeSet(pcs: readonly PitchClass[], n: number): PitchClass[] {
  return pcs.map((pc) => transpose(pc, n));
}

// Inversion around axis a: i(pc) = 2a - pc (mod 12). Default axis a = 0
// (the C–F# axis) which gives standard pitch-class inversion.
export function invert(pc: PitchClass, axis: PitchClass = 0): PitchClass {
  return mod12(2 * axis - pc);
}

export function invertSet(
  pcs: readonly PitchClass[],
  axis: PitchClass = 0,
): PitchClass[] {
  return pcs.map((pc) => invert(pc, axis));
}

export function pcName(pc: PitchClass): string {
  return PITCH_NAMES[mod12(pc)];
}

export function solfegeInC(pc: PitchClass): string | undefined {
  return C_MAJOR_SOLFEGE[mod12(pc)];
}

// Lenient accept check for "pitch class N in C major is…" — accepts the
// note name (any case, with sharp/flat normalized) or the movable-do
// solfege syllable.
export function matchesPcInC(input: string, pc: PitchClass): boolean {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!cleaned) return false;
  const target = pcName(pc).toLowerCase();
  // Allow "f#" and "fsharp"; "eb" and "eflat".
  const norm = cleaned
    .replace(/sharp$/, '#')
    .replace(/flat$/, 'b')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
  if (norm === target) return true;
  const solf = solfegeInC(pc);
  if (solf && cleaned === solf) return true;
  return false;
}
