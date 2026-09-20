/**
 * The wire shape of a System One request, transcribed from TypeSafe's public
 * API docs for Jev (POST https://api.typesafe.ai/v1/systemone) as of
 * September 2026.
 *
 * Nothing here talks to TypeSafe. This is the contract a mock has to honor so
 * that swapping the mock for the real client is a one-line change.
 *
 * Two naming conventions are in the wild for the yes/no primitive. TypeSafe's
 * own docs call it a `noul` — a contraction of Bernoulli, which is exactly what
 * it is: one trial, one probability — and put P(yes) in a `noul` field. Several
 * third-party clients expose the same primitive as `boolean` with a
 * `probability` field. We model the `boolean` spelling and carry `noul` as an
 * alias on the answer.
 */

/** Cardinality limits the API enforces. Enforce them locally and you never pay
 *  a round trip to learn you wrote a one-level rubric. */
export const LIMITS = {
  minChoiceOptions: 2,
  maxChoiceOptions: 255,
  minScoreLevels: 2,
  maxScoreLevels: 10,
} as const;

export interface BooleanQuestion {
  type: 'boolean';
  instructions: string;
  /** Optional gloss on what each side means. Either side may be omitted. */
  criteria?: { true?: string; false?: string };
}

export interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  /** Option id -> description, or null when the id says enough. 2..255 keys. */
  criteria: Record<string, string | null>;
}

export interface ScoreQuestion {
  type: 'score';
  instructions: string;
  /** Ordered rubric levels, lowest first. 2..10 entries. */
  criteria: readonly string[];
}

export type Question = BooleanQuestion | ChoiceQuestion | ScoreQuestion;

export interface BooleanAnswer {
  type: 'boolean';
  /** P(yes), in [0, 1]. There is no separate confidence: the value *is* the
   *  belief. 0.5 means the model split its bet, not that the truth is middling. */
  probability: number;
  /** Alias for `probability`, matching TypeSafe's own field name. */
  noul: number;
}

export interface ChoiceAnswer {
  type: 'choice';
  /** The argmax over `probabilities`. */
  choice: string;
  probabilities: Record<string, number>;
  /** Peakedness of the distribution, in [0, 1]. On the wire this arrives under
   *  provider metadata rather than on the answer; we inline it. */
  confidence: number;
}

export interface ScoreAnswer {
  type: 'score';
  /** Probability-weighted mean level index, in [0, levels-1]. A fractional
   *  position on the rubric, not an index into it. */
  score: number;
  /** Level index (as a string key) -> probability. */
  probabilities: Record<string, number>;
  legend: readonly string[];
  confidence: number;
}

export type Answer = BooleanAnswer | ChoiceAnswer | ScoreAnswer;

/** Maps a question set to its answer set, keeping the ids and narrowing each
 *  answer to the type its question asked for. This is the part worth having in
 *  TypeScript: the caller branches on `answers.tone.choice` and the compiler
 *  knows `tone` is a choice. */
export type Answers<Q extends Record<string, Question>> = {
  [K in keyof Q]: Q[K] extends BooleanQuestion
    ? BooleanAnswer
    : Q[K] extends ChoiceQuestion
      ? ChoiceAnswer
      : Q[K] extends ScoreQuestion
        ? ScoreAnswer
        : Answer;
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface SystemOneResponse<Q extends Record<string, Question>> {
  model: string;
  answers: Answers<Q>;
  usage: Usage;
}

/** The single method a System One client needs. Questions are evaluated in
 *  parallel and in isolation against the same state, so a twenty-question
 *  request is one round trip and very nearly the price of one question. */
export interface SystemOne {
  decide<Q extends Record<string, Question>>(
    state: string,
    questions: Q,
  ): Promise<SystemOneResponse<Q>>;
}

export class QuestionError extends Error {}

/** Validate a question set the way the API would, before anything is sent.
 *  Throws on the first problem. */
export function validate(questions: Record<string, Question>): void {
  const ids = Object.keys(questions);
  if (ids.length === 0) throw new QuestionError('no questions');
  for (const id of ids) {
    const q = questions[id]!;
    if (!q.instructions || !q.instructions.trim()) {
      throw new QuestionError(`${id}: instructions are required`);
    }
    if (q.type === 'choice') {
      const n = Object.keys(q.criteria).length;
      if (n < LIMITS.minChoiceOptions || n > LIMITS.maxChoiceOptions) {
        throw new QuestionError(
          `${id}: a choice takes ${LIMITS.minChoiceOptions}..${LIMITS.maxChoiceOptions} options, got ${n}`,
        );
      }
    } else if (q.type === 'score') {
      const n = q.criteria.length;
      if (n < LIMITS.minScoreLevels || n > LIMITS.maxScoreLevels) {
        throw new QuestionError(
          `${id}: a score takes ${LIMITS.minScoreLevels}..${LIMITS.maxScoreLevels} levels, got ${n}. ` +
            'A lone level scores 0 with full confidence, which tells you nothing.',
        );
      }
    }
  }
}
