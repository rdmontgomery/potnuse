import type { Phrase } from './types';
import { SONGS } from './songs';

// SRS state per phrase. Same Leitner shape as the primer experiment.
export interface PhraseState {
  level: number;
  nextReview: number;
  seen: number;
  correct: number;
}
export type PhraseStates = Record<string, PhraseState>;

export interface PhraseStats {
  correct: number;
  total: number;
  bestStreak: number;
}

export const PHRASE_INTERVAL = (level: number) => 2 + Math.pow(2, level);

// Flatten every song's phrase ranges into a deck of practice cards. Songs
// without phrases (the warm-up scales) are skipped.
export function getAllPhrases(): Phrase[] {
  const out: Phrase[] = [];
  for (const song of SONGS) {
    if (!song.phrases || song.phrases.length === 0) continue;
    song.phrases.forEach((p, i) => {
      out.push({
        id: `${song.id}:${i}`,
        songId: song.id,
        songTitle: song.title,
        index: i,
        label: p.label,
        notes: song.notes.slice(p.start, p.end),
      });
    });
  }
  return out;
}

export function initialPhraseStates(phrases: Phrase[]): PhraseStates {
  const s: PhraseStates = {};
  phrases.forEach((p, i) => {
    s[p.id] = { level: 0, nextReview: i, seen: 0, correct: 0 };
  });
  return s;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickNextPhrase(phrases: Phrase[], states: PhraseStates, excludeId: string | null): Phrase | null {
  const pool = phrases.filter(p => p.id !== excludeId);
  if (pool.length === 0) return null;
  shuffle(pool);
  pool.sort((a, b) => (states[a.id]?.nextReview ?? 0) - (states[b.id]?.nextReview ?? 0));
  return pool[0];
}

export function updatePhraseState(states: PhraseStates, id: string, correct: boolean, step: number): PhraseStates {
  const s = states[id] ?? { level: 0, nextReview: 0, seen: 0, correct: 0 };
  const next = { ...states };
  if (correct) {
    const level = Math.min(s.level + 1, 5);
    next[id] = {
      ...s,
      level,
      nextReview: step + PHRASE_INTERVAL(level) + Math.floor(Math.random() * 2),
      seen: s.seen + 1,
      correct: s.correct + 1,
    };
  } else {
    next[id] = {
      ...s,
      level: 0,
      nextReview: step + 2 + Math.floor(Math.random() * 2),
      seen: s.seen + 1,
    };
  }
  return next;
}
