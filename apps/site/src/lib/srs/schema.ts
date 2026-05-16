import type { Card as FSRSCard } from 'ts-fsrs';
import type { PitchClass } from '@/lib/music/pitchClass';

// SRS card model. A Card is a (prompt, scheduling-state) pair anchored to a
// module + concept tag, persisted in IndexedDB. Prompts carry the question
// and what counts as a correct answer; the instrument the prompt mounts on
// is resolved at /practice time from the concept tag, not stored on the
// card itself.

export type CardId = string;
export type ConceptId = string;
export type ModuleId = number;

export type Prompt =
  | {
      kind: 'click-on-clock';
      question: string;
      // The user must click these (and only these) pitch classes.
      expectedPcs: readonly PitchClass[];
      // Optional hint shown above the clock.
      hint?: string;
    }
  | {
      kind: 'freeform-pc-in-key';
      question: string;
      // Target pitch class in C major; matchesPcInC handles lenient parsing.
      expectedPc: PitchClass;
      placeholder?: string;
    }
  | {
      kind: 'multiple-choice';
      question: string;
      // Mutually-exclusive labels shown as a button strip.
      choices: readonly string[];
      // Index into choices of the right answer.
      correctIndex: number;
      // Optional one-line elaboration on the correct answer, surfaced
      // after the user picks something.
      explanation?: string;
    }
  | {
      kind: 'identify-by-ear';
      question: string;
      // Audio payload. 'chord' plays all midi notes simultaneously;
      // 'sequence' plays them one at a time with noteDuration spacing
      // (defaults to 0.4s).
      audio: {
        kind: 'chord' | 'sequence';
        midi: readonly number[];
        noteDuration?: number;
        // Sustain per note in seconds. For chords this also serves
        // as the chord's hold time. Defaults to noteDuration + 0.1.
        sustain?: number;
      };
      choices: readonly string[];
      correctIndex: number;
      explanation?: string;
    };

export type Verdict = 'correct' | 'wrong' | 'unsure';

export interface Card {
  id: CardId;
  moduleId: ModuleId;
  concept: ConceptId;
  prompt: Prompt;
  // ts-fsrs scheduling state. Persisted as-is so a future change to the
  // scheduler can keep reading prior cards.
  scheduling: FSRSCard;
  // Wall-clock timestamps so we can answer "have I seen this before?"
  // without inspecting scheduling internals.
  createdAt: number;
  lastReviewedAt?: number;
  // Latest verdict, so the section can render the prior outcome on return
  // visits without re-prompting.
  lastVerdict?: Verdict;
}
