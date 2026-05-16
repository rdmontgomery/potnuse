import type { Card } from './schema';
import { newScheduling } from './scheduler';
import { BWV269 } from '@/lib/music/bwv269';
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
  for (const n of BWV269.notes as PNote[]) {
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

const ALL_CARD_DEFS = [...MODULE_0_CARD_DEFS, ...MODULE_1_CARD_DEFS];

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
