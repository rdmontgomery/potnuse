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

export function freshModuleZeroCards(now: Date = new Date()): Card[] {
  return MODULE_0_CARD_DEFS.map((def) => ({
    ...def,
    scheduling: newScheduling(now),
    createdAt: now.getTime(),
  }));
}

// Look up a card definition by id without touching the store. Useful for
// rendering /practice's instrument when the persisted card lacks the prompt
// content (older write, fresh seed).
export function getCardSeed(id: string): Card | undefined {
  const def = MODULE_0_CARD_DEFS.find((d) => d.id === id);
  if (!def) return undefined;
  return {
    ...def,
    scheduling: newScheduling(),
    createdAt: Date.now(),
  };
}

export const ALL_SEED_CARD_IDS = MODULE_0_CARD_DEFS.map((d) => d.id);
