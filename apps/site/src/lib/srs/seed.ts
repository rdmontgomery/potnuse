import type { Card } from './schema';
import { newScheduling } from './scheduler';
import { CHORALE_PHRASE } from '@/lib/music/chorale-phrase';
import {
  pitchClassOf,
  transposeSet,
  type PitchClass,
} from '@/lib/music/pitchClass';
import type { PNote } from '@/lib/pentimento/types';

// Distinct soprano pitch classes in the chorale phrase, sorted. Module 0's
// click-on-clock card asks the user to transpose these by +3.
const SOPRANO_PCS: readonly PitchClass[] = (() => {
  const set = new Set<PitchClass>();
  for (const n of CHORALE_PHRASE.notes as PNote[]) {
    if (n.voice === 'lead') set.add(pitchClassOf(n.pitch));
  }
  return [...set].sort((a, b) => a - b);
})();

export const MODULE_0_SOPRANO_PCS = SOPRANO_PCS;

// Bare card definitions. Scheduling state is generated fresh per card the
// first time we touch the store, so seeds are pure data and don't depend on
// the current time.
const MODULE_0_CARD_DEFS = [
  {
    id: 'm0.transpose-m3',
    moduleId: 0,
    concept: 'transposition' as const,
    prompt: {
      kind: 'click-on-clock' as const,
      question:
        'Transpose the chorale phrase up a minor third. Click each new pitch class on the clock.',
      expectedPcs: transposeSet(SOPRANO_PCS, 3),
      hint: `The phrase uses pcs ${SOPRANO_PCS.join(', ')}. Add three to each, mod 12.`,
    },
  },
  {
    id: 'm0.pc-5-in-c',
    moduleId: 0,
    concept: 'pitch-class' as const,
    prompt: {
      kind: 'freeform-pc-in-key' as const,
      question:
        'Pitch class 5 in the key of C major is also known as …',
      expectedPc: 5 satisfies PitchClass,
      placeholder: 'a note name, or a solfege syllable',
    },
  },
] as const;

export type ModuleZeroCardId = (typeof MODULE_0_CARD_DEFS)[number]['id'];

// Module 1: Spectral Foundations. Both prompts lean on the overtone-series
// content — Behold shows partials 1-8 of C2, Derive demonstrates that
// partials 4-5-6 are always a major triad, Operate lets the user mute
// individual partials. The two prompts check whether the listener took
// home the chord-from-spectrum claim and the simple partial arithmetic.
const MODULE_1_CARD_DEFS = [
  {
    id: 'm1.triad-from-partials',
    moduleId: 1,
    concept: 'overtone-triad' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Stack partials 4, 5, and 6 of any fundamental. What chord quality do you get?',
      choices: [
        'minor triad',
        'major triad',
        'diminished triad',
        'dominant seventh',
      ],
      correctIndex: 1,
      explanation:
        'Major triad. Partial 4 is the fundamental (two octaves up), 5 is the major third above it, 6 is the perfect fifth — the triad is a fact of the spectrum.',
    },
  },
  {
    id: 'm1.fifth-partial',
    moduleId: 1,
    concept: 'partial-arithmetic' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Which partial first introduces the major third of the fundamental?',
      choices: ['3rd', '4th', '5th', '6th'],
      correctIndex: 2,
      explanation:
        'The 5th partial. Frequency ratio 5:4 with the 4th partial — that\'s the just-intonation major third.',
    },
  },
] as const;

export type ModuleOneCardId = (typeof MODULE_1_CARD_DEFS)[number]['id'];

// Module 2: Intervals and Generators. Both prompts probe the
// gcd(N, 12) → orbit-size correspondence — the central fact of the
// module. Multiple choice keeps the answer space tight so the prompt
// reads as a quick recall, not a free-form puzzle.
const MODULE_2_CARD_DEFS = [
  {
    id: 'm2.generators',
    moduleId: 2,
    concept: 'generators-of-z12' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Which of the following is the complete set of generators of Z 12 (the intervals that visit every pitch class)?',
      choices: [
        '{2, 4, 6, 8, 10}',
        '{1, 5, 7, 11}',
        '{3, 6, 9}',
        '{0, 4, 8}',
      ],
      correctIndex: 1,
      explanation:
        'The generators are the intervals coprime to 12: gcd(N, 12) = 1 holds exactly for N ∈ {1, 5, 7, 11}.',
    },
  },
  {
    id: 'm2.orbit-of-3',
    moduleId: 2,
    concept: 'orbit-size' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Step by 3 semitones repeatedly from any starting pitch class. How many distinct pcs does the orbit visit before returning to start?',
      choices: ['3', '4', '6', '12'],
      correctIndex: 1,
      explanation:
        'Orbit size = 12 / gcd(3, 12) = 12 / 3 = 4. The orbit is a diminished seventh.',
    },
  },
] as const;

export type ModuleTwoCardId = (typeof MODULE_2_CARD_DEFS)[number]['id'];

// Module 3: Scales as Subsets. Both prompts probe the mode-as-rotation
// view of the diatonic scale.
const MODULE_3_CARD_DEFS = [
  {
    id: 'm3.dorian-degree',
    moduleId: 3,
    concept: 'modes-as-rotation' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Dorian mode is built on which scale degree of its parent major scale?',
      choices: ['1st (tonic)', '2nd', '3rd', '5th'],
      correctIndex: 1,
      explanation:
        'Dorian is the second mode — built on the 2nd scale degree of major. C major\'s 2nd degree is D, so D Dorian uses the same seven pitches as C major.',
    },
  },
  {
    id: 'm3.gap-pattern',
    moduleId: 3,
    concept: 'diatonic-gaps' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'How many half-step gaps appear in the diatonic gap pattern (2-2-1-2-2-2-1)?',
      choices: ['1', '2', '3', '5'],
      correctIndex: 1,
      explanation:
        'Two — the 3→4 step (E→F in C major) and the 7→8 step (B→C). The other five gaps are whole steps. That distribution is what makes diatonic the maximally even 7-subset of Z 12.',
    },
  },
  {
    id: 'm3.identify-dorian',
    moduleId: 3,
    concept: 'mode-by-ear' as const,
    prompt: {
      kind: 'identify-by-ear' as const,
      question: 'Listen to the ascending scale and identify the mode.',
      audio: {
        kind: 'sequence' as const,
        midi: [62, 64, 65, 67, 69, 71, 72, 74], // D Dorian
        noteDuration: 0.38,
      },
      choices: ['Ionian (major)', 'Dorian', 'Phrygian', 'Lydian'],
      correctIndex: 1,
      explanation:
        'Dorian — the second mode of major. D Dorian uses the same pitches as C major but starts on D. Listen for the minor third (D→F) alongside the major sixth (D→B): a darker root with one bright note overhead is the Dorian signature.',
    },
  },
] as const;

export type ModuleThreeCardId = (typeof MODULE_3_CARD_DEFS)[number]['id'];

// Module 4: Triads and Roman Numerals.
const MODULE_4_CARD_DEFS = [
  {
    id: 'm4.quality-of-v',
    moduleId: 4,
    concept: 'triad-quality' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'The triad built on the 5th scale degree of a major key (the V chord) has what quality?',
      choices: ['major', 'minor', 'diminished', 'augmented'],
      correctIndex: 0,
      explanation:
        'Major. In C major: G–B–D, the root, major third, and perfect fifth. V is one of the three major triads (I, IV, V) in any major key.',
    },
  },
  {
    id: 'm4.quality-of-vii',
    moduleId: 4,
    concept: 'triad-quality' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Stack thirds from B in C major (B, D, F). What quality is that triad?',
      choices: ['major', 'minor', 'diminished', 'augmented'],
      correctIndex: 2,
      explanation:
        'Diminished. B–D is a minor third; D–F is also a minor third; B–F is a tritone. The vii° is the only diminished triad in a major key.',
    },
  },
  {
    id: 'm4.identify-quality',
    moduleId: 4,
    concept: 'chord-quality-by-ear' as const,
    prompt: {
      kind: 'identify-by-ear' as const,
      question: 'Listen to the chord. Which quality is it?',
      audio: {
        kind: 'chord' as const,
        midi: [60, 63, 67], // C minor
        sustain: 1.4,
      },
      choices: ['major', 'minor', 'diminished', 'augmented'],
      correctIndex: 1,
      explanation:
        'Minor. Root, minor third, perfect fifth. The only difference between this and C major is one semitone on the third — but the affect is different in a way the ear hears immediately.',
    },
  },
] as const;

export type ModuleFourCardId = (typeof MODULE_4_CARD_DEFS)[number]['id'];

// Module 5: Functional Harmony.
const MODULE_5_CARD_DEFS = [
  {
    id: 'm5.not-predominant',
    moduleId: 5,
    concept: 'harmonic-function' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Which of these does NOT serve a predominant function in a major key?',
      choices: ['ii', 'IV', 'V', 'vi (used as pre-dominant substitute)'],
      correctIndex: 2,
      explanation:
        'V is the dominant — the chord that pulls toward I. The predominants set up the dominant; they don\'t replace it. ii and IV are the canonical pair; vi can stand in for the predominant in some progressions but it\'s not the wrong answer here. V is unambiguously not a predominant.',
    },
  },
  {
    id: 'm5.authentic-cadence',
    moduleId: 5,
    concept: 'cadence' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'An authentic cadence ends with which two-chord motion?',
      choices: ['IV → I', 'V → I', 'V → vi', 'ii → V'],
      correctIndex: 1,
      explanation:
        'V → I is the authentic cadence — the most decisive way to land on the tonic. IV → I is the plagal cadence ("amen"); V → vi is the deceptive cadence; ii → V is mid-phrase, not a close.',
    },
  },
] as const;

export type ModuleFiveCardId = (typeof MODULE_5_CARD_DEFS)[number]['id'];

// Module 6: Chromatic Harmony.
const MODULE_6_CARD_DEFS = [
  {
    id: 'm6.v-of-v-meaning',
    moduleId: 6,
    concept: 'secondary-dominants' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'In C major, what does the chord notation V/V refer to?',
      choices: [
        'The fifth scale degree of the fifth scale degree (B major)',
        'The dominant of the dominant — D major, resolving to G',
        'G major in second inversion',
        'A secondary tonic on A minor',
      ],
      correctIndex: 1,
      explanation:
        'V/V reads "the dominant of V." In C major: V is G, and the dominant of G is D major (D F♯ A). It tonicizes V before V resolves to I.',
    },
  },
  {
    id: 'm6.identify-bVI',
    moduleId: 6,
    concept: 'modal-mixture' as const,
    prompt: {
      kind: 'identify-by-ear' as const,
      question:
        'Listen to this chord. Which borrowed chord in C major did you hear?',
      audio: {
        kind: 'chord' as const,
        midi: [68, 72, 75], // A♭ major triad — ♭VI in C
        sustain: 1.6,
      },
      choices: [
        '♭III (E♭ major)',
        '♭VI (A♭ major)',
        '♭VII (B♭ major)',
        'iv (F minor)',
      ],
      correctIndex: 1,
      explanation:
        '♭VI — A♭ major. Borrowed from C minor (which has the notes A♭, C, E♭ in its scale). Familiar from sudden-color moments in pop and classical alike.',
    },
  },
] as const;

export type ModuleSixCardId = (typeof MODULE_6_CARD_DEFS)[number]['id'];

// Module 7: Neo-Riemannian theory.
const MODULE_7_CARD_DEFS = [
  {
    id: 'm7.plr-r-target',
    moduleId: 7,
    concept: 'plr-transformations' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question: 'Apply R to C major. What triad do you get?',
      choices: ['C minor', 'E minor', 'A minor', 'G major'],
      correctIndex: 2,
      explanation:
        'A minor — the relative minor of C major. R swaps a major triad with its relative minor; they share two pitches (C and E).',
    },
  },
  {
    id: 'm7.plr-involution',
    moduleId: 7,
    concept: 'plr-involutions' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'Each of P, L, R is an involution. What does that mean?',
      choices: [
        'They commute with each other',
        'Applying any one of them twice returns the original triad',
        'They generate every possible chord',
        'They preserve the root pitch class',
      ],
      correctIndex: 1,
      explanation:
        'Each is its own inverse: P(P(x)) = x, L(L(x)) = x, R(R(x)) = x. That\'s the formal meaning of involution.',
    },
  },
] as const;

export type ModuleSevenCardId = (typeof MODULE_7_CARD_DEFS)[number]['id'];

// Module 8: Orbifold Geometry.
const MODULE_8_CARD_DEFS = [
  {
    id: 'm8.plr-cost',
    moduleId: 8,
    concept: 'voice-leading-cost' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'In Tymoczko\'s voice-leading metric, what\'s the total semitone motion between two triads connected by a single P, L, or R from Module 7?',
      choices: ['0', '1', '2', '3'],
      correctIndex: 1,
      explanation:
        '1 semitone. P, L, and R each move exactly one voice by a half or whole step (with the half step being more common) — they\'re the minimal-cost edges in the orbifold.',
    },
  },
  {
    id: 'm8.geodesic-meaning',
    moduleId: 8,
    concept: 'orbifold-geodesic' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'What does "voice leading is geodesic motion in the orbifold" mean, concretely?',
      choices: [
        'The shortest distance in chord-space equals the minimal voice leading.',
        'Every chord progression follows a curved path.',
        'Voice leadings preserve consonance.',
        'Only major triads have geodesic paths.',
      ],
      correctIndex: 0,
      explanation:
        'Geodesic = shortest path. Tymoczko\'s claim is that the shortest path between two chords *inside* the orbifold geometry is exactly the minimal voice-leading distance — the assignment of voices that moves the fewest total semitones.',
    },
  },
] as const;

export type ModuleEightCardId = (typeof MODULE_8_CARD_DEFS)[number]['id'];

// Module 9: Statistical Tonality.
const MODULE_9_CARD_DEFS = [
  {
    id: 'm9.top-degree',
    moduleId: 9,
    concept: 'probe-tone-profile' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'In Krumhansl\'s major-key probe-tone profile, which scale degree gets the highest fit rating?',
      choices: ['the dominant (5th)', 'the mediant (3rd)', 'the tonic (1st)', 'the leading tone (7th)'],
      correctIndex: 2,
      explanation:
        'The tonic. Listeners rate it as fitting the key context best, by a wide margin. The dominant comes second, the mediant third — a hierarchy that closely tracks the diatonic functions Module 5 covered.',
    },
  },
  {
    id: 'm9.key-finding-method',
    moduleId: 9,
    concept: 'key-finding' as const,
    prompt: {
      kind: 'multiple-choice' as const,
      question:
        'In the Krumhansl-Schmuckler key-finding algorithm, how is a passage\'s key inferred from its notes?',
      choices: [
        'By looking at the first and last notes',
        'By correlating the passage\'s pc histogram against all 24 probe-tone profiles',
        'By identifying the most-common chord',
        'By detecting the lowest note as the tonic',
      ],
      correctIndex: 1,
      explanation:
        'Correlation against all 24 profiles. The highest-correlated (tonic, mode) pair is the inferred key. The algorithm is statistical, not symbolic — it doesn\'t parse chords, only weighs pcs.',
    },
  },
] as const;

export type ModuleNineCardId = (typeof MODULE_9_CARD_DEFS)[number]['id'];

const ALL_CARD_DEFS = [
  ...MODULE_0_CARD_DEFS,
  ...MODULE_1_CARD_DEFS,
  ...MODULE_2_CARD_DEFS,
  ...MODULE_3_CARD_DEFS,
  ...MODULE_4_CARD_DEFS,
  ...MODULE_5_CARD_DEFS,
  ...MODULE_6_CARD_DEFS,
  ...MODULE_7_CARD_DEFS,
  ...MODULE_8_CARD_DEFS,
  ...MODULE_9_CARD_DEFS,
];

function defsToCards(
  defs: readonly (typeof ALL_CARD_DEFS)[number][],
  now: Date,
): Card[] {
  return defs.map((def) => ({
    ...def,
    scheduling: newScheduling(now),
    createdAt: now.getTime(),
  }));
}

export function freshModuleZeroCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_0_CARD_DEFS, now);
}

export function freshModuleOneCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_1_CARD_DEFS, now);
}

export function freshModuleTwoCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_2_CARD_DEFS, now);
}

export function freshModuleThreeCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_3_CARD_DEFS, now);
}

export function freshModuleFourCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_4_CARD_DEFS, now);
}

export function freshModuleFiveCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_5_CARD_DEFS, now);
}

export function freshModuleSixCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_6_CARD_DEFS, now);
}

export function freshModuleSevenCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_7_CARD_DEFS, now);
}

export function freshModuleEightCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_8_CARD_DEFS, now);
}

export function freshModuleNineCards(now: Date = new Date()): Card[] {
  return defsToCards(MODULE_9_CARD_DEFS, now);
}

// Every card the curriculum currently seeds. Used by /practice to make sure
// the store has all known cards before pulling the due queue.
export function freshAllCards(now: Date = new Date()): Card[] {
  return defsToCards(ALL_CARD_DEFS, now);
}

// Look up a card definition by id without touching the store. Useful for
// rendering /practice's instrument when the persisted card lacks the prompt
// content (older write, fresh seed).
export function getCardSeed(id: string): Card | undefined {
  const def = ALL_CARD_DEFS.find((d) => d.id === id);
  if (!def) return undefined;
  return {
    ...def,
    scheduling: newScheduling(),
    createdAt: Date.now(),
  };
}

export const ALL_SEED_CARD_IDS = ALL_CARD_DEFS.map((d) => d.id);
