import { fsrs, createEmptyCard, Rating, type Card as FSRSCard } from 'ts-fsrs';
import type { Verdict } from './schema';

// Wrapper around ts-fsrs so the rest of the app speaks in our verdicts
// (correct / wrong / unsure) instead of FSRS rating integers, and so that
// upgrading the scheduler stays local to this file.

const scheduler = fsrs();

export function newScheduling(now: Date = new Date()): FSRSCard {
  return createEmptyCard(now);
}

export function applyVerdict(
  state: FSRSCard,
  verdict: Verdict,
  now: Date = new Date(),
): FSRSCard {
  const rating =
    verdict === 'correct'
      ? Rating.Good
      : verdict === 'unsure'
        ? Rating.Hard
        : Rating.Again;
  const log = scheduler.repeat(state, now);
  return log[rating].card;
}

// A card is due once its scheduling.due wall-clock has elapsed. We coerce
// `due` through Date() because Dexie deserializes it as a string and ts-fsrs
// expects a real Date for comparisons.
export function isDue(state: FSRSCard, now: Date = new Date()): boolean {
  const due = state.due instanceof Date ? state.due : new Date(state.due);
  return due.getTime() <= now.getTime();
}

export function dueAt(state: FSRSCard): Date {
  return state.due instanceof Date ? state.due : new Date(state.due);
}
