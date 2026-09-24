/**
 * Two mocks for a System One model, and they are not interchangeable.
 *
 * `shapeOnlyJev` fakes the response *shape*. It gets your plumbing green: the
 * client is wired, the answers parse, the branches are reachable. It tells you
 * nothing about whether your thresholds are sane, because a uniform random
 * probability is uncalibrated by construction.
 *
 * `calibratedJev` fakes the *joint distribution* of forecast and outcome. It
 * draws a belief first and the ground truth second — from that belief — so the
 * stream it emits is calibrated by construction, and it hands you the hidden
 * truth so you can score your own policy against a known oracle. Then
 * `temperature` lets you break the calibration on purpose and watch what your
 * pipeline does when the vendor ships a version whose confidence runs hot.
 */

import {
  type Answer,
  type Answers,
  type NoulAnswer,
  type ChoiceAnswer,
  type Question,
  type ScoreAnswer,
  type SystemOne,
  type SystemOneResponse,
  validate,
} from './protocol.ts';
import { beta, categorical, dirichlet, rng, type Rng } from './rng.ts';
import type { Pair } from './calibration.ts';

export interface MockOptions {
  seed?: number;
  model?: string;
  /**
   * Distortion applied to every reported probability. 1 is honest. Below 1
   * sharpens the distribution (overconfident); above 1 flattens it toward
   * uniform (underconfident). The latent truth is drawn from the *undistorted*
   * belief, so any T other than 1 produces a measurably miscalibrated stream.
   */
  temperature?: number;
  /**
   * Dirichlet concentration for choice and score questions. Below 1 concentrates
   * mass on a single option: most items are easy, a few are genuinely ambiguous.
   * Around 1 is uniform over the simplex. Above 1 makes everything a coin flip.
   */
  concentration?: number;
  /** Beta prior on P(yes) for boolean questions. Symmetric and U-shaped by
   *  default: most yes/no calls are clear, some are not. */
  booleanPrior?: readonly [number, number];
  /** Artificial delay per call, in ms. Jev's real end-to-end latency is 70-500ms. */
  latencyMs?: number;
}

const DEFAULTS = {
  seed: 1,
  model: 'jev-mock-1.0.0',
  temperature: 1,
  concentration: 0.45,
  booleanPrior: [0.45, 0.45] as const,
  latencyMs: 0,
};

/** One scored decision, with the answer the mock gave and the truth it kept. */
export interface Observation {
  state: string;
  questionId: string;
  type: Question['type'];
  /** The latent truth: the option/level drawn, or whether the answer is yes. */
  actual: string | number | boolean;
  /** What the mock reported as its top answer. */
  reported: string | number | boolean;
  /** The forecast to score: top-1 probability against top-1 correctness. This is
   *  the quantity calibration is about — not the `confidence` field. */
  pair: Pair;
}

export interface CalibratedMock extends SystemOne {
  /** Every decision this mock has made, in call order. Feed it to `brier`,
   *  `ece` or `murphy`. */
  readonly log: readonly Observation[];
  clear(): void;
}

// --- distortion -------------------------------------------------------------

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function temper(p: number, t: number): number {
  if (t === 1) return p;
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  return sigmoid(logit(q) / t);
}

function temperVector(w: readonly number[], t: number): number[] {
  if (t === 1) return [...w];
  const raised = w.map((x) => Math.pow(Math.max(x, 1e-12), 1 / t));
  const sum = raised.reduce((s, x) => s + x, 0);
  return raised.map((x) => x / sum);
}

/** 1 - normalized Shannon entropy. TypeSafe documents confidence only as
 *  "derived from the probability distribution"; the exact formula is not
 *  public, so this is a stand-in with the right monotonicity. Treat it as a
 *  spread statistic, not a forecast: it is not what RLCD calibrates, and you
 *  should not put it in a decision threshold. */
export function peakedness(w: readonly number[]): number {
  const k = w.length;
  if (k < 2) return 1;
  let h = 0;
  for (const x of w) if (x > 0) h -= x * Math.log(x);
  return 1 - h / Math.log(k);
}

// --- deterministic per-item seeding -----------------------------------------

/** FNV-1a over state + question id, so the same item always gets the same
 *  answer regardless of call order or concurrency. */
function itemSeed(seed: number, state: string, id: string): number {
  let h = 0x811c9dc5 ^ seed;
  const s = `${id}\u0000${state}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const tokens = (s: string) => Math.ceil(s.length / 4);

function usageFor(state: string, questions: Record<string, Question>) {
  return {
    input_tokens: tokens(state) + tokens(JSON.stringify(questions)),
    // Jev prices output at zero. "Too cheap to meter" is their phrasing.
    output_tokens: 0,
  };
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve();

// --- shape-only mock --------------------------------------------------------

/**
 * Right types, honest about being garbage. Use it in CI to prove the wiring
 * works, and never to choose a threshold.
 */
export function shapeOnlyJev(options: MockOptions = {}): SystemOne {
  const opts = { ...DEFAULTS, ...options };
  return {
    async decide<Q extends Record<string, Question>>(state: string, questions: Q) {
      validate(questions);
      await sleep(opts.latencyMs);
      const answers = {} as Record<string, Answer>;
      for (const [id, q] of Object.entries(questions)) {
        const r = rng(itemSeed(opts.seed, state, id));
        answers[id] = uniformAnswer(r, q);
      }
      return {
        model: opts.model,
        answers: answers as Answers<Q>,
        usage: usageFor(state, questions),
      } satisfies SystemOneResponse<Q>;
    },
  };
}

function uniformAnswer(r: Rng, q: Question): Answer {
  if (q.type === 'noul') {
    const p = r();
    return { type: 'noul', noul: p } satisfies NoulAnswer;
  }
  if (q.type === 'choice') {
    const keys = Object.keys(q.criteria);
    const w = dirichlet(r, keys.map(() => 1));
    return choiceAnswer(keys, w, w);
  }
  const w = dirichlet(r, q.criteria.map(() => 1));
  return scoreAnswer(q.criteria, w, w);
}

// --- calibrated mock --------------------------------------------------------

/**
 * The generative order is inverted on purpose. A real model sees an item whose
 * answer is already fixed and produces a belief about it; we cannot do that
 * without a model, so we draw the belief from a prior and then draw the truth
 * from the belief. The result is a stream in which reported probabilities are
 * exactly as honest as they claim — the fixed point you want to test against
 * before you test against a vendor.
 */
export function calibratedJev(options: MockOptions = {}): CalibratedMock {
  const opts = { ...DEFAULTS, ...options };
  const log: Observation[] = [];

  return {
    log,
    clear() {
      log.length = 0;
    },
    async decide<Q extends Record<string, Question>>(state: string, questions: Q) {
      validate(questions);
      await sleep(opts.latencyMs);
      const answers = {} as Record<string, Answer>;

      for (const [id, q] of Object.entries(questions)) {
        const r = rng(itemSeed(opts.seed, state, id));

        if (q.type === 'noul') {
          // belief first...
          const belief = beta(r, opts.booleanPrior[0], opts.booleanPrior[1]);
          // ...then the truth, drawn from it.
          const actual = r() < belief;
          const reportedP = temper(belief, opts.temperature);
          answers[id] = {
            type: 'noul',
            noul: reportedP,
          } satisfies NoulAnswer;
          log.push({
            state,
            questionId: id,
            type: 'noul',
            actual,
            reported: reportedP >= 0.5,
            pair: { p: reportedP, y: actual ? 1 : 0 },
          });
          continue;
        }

        const levels =
          q.type === 'choice' ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
        const belief = dirichlet(
          r,
          levels.map(() => opts.concentration),
        );
        const actualIndex = categorical(r, belief);
        const reportedW = temperVector(belief, opts.temperature);
        const top = argmax(reportedW);

        answers[id] =
          q.type === 'choice'
            ? choiceAnswer(levels, reportedW, belief)
            : scoreAnswer(q.criteria, reportedW, belief);

        log.push({
          state,
          questionId: id,
          type: q.type,
          actual: q.type === 'choice' ? levels[actualIndex]! : actualIndex,
          reported: q.type === 'choice' ? levels[top]! : top,
          // Top-1 calibration: did the option we named turn out to be the one,
          // as often as we said it would?
          pair: { p: reportedW[top]!, y: top === actualIndex ? 1 : 0 },
        });
      }

      return {
        model: opts.model,
        answers: answers as Answers<Q>,
        usage: usageFor(state, questions),
      } satisfies SystemOneResponse<Q>;
    },
  };
}

function argmax(w: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < w.length; i++) if (w[i]! > w[best]!) best = i;
  return best;
}

function choiceAnswer(
  keys: string[],
  reported: number[],
  _belief: readonly number[],
): ChoiceAnswer {
  const probabilities: Record<string, number> = {};
  keys.forEach((k, i) => (probabilities[k] = reported[i]!));
  return {
    type: 'choice',
    choice: keys[argmax(reported)]!,
    probabilities,
    confidence: peakedness(reported),
  };
}

function scoreAnswer(
  legend: readonly string[],
  reported: number[],
  _belief: readonly number[],
): ScoreAnswer {
  const probabilities: Record<string, number> = {};
  reported.forEach((p, i) => (probabilities[String(i)] = p));
  return {
    type: 'score',
    // Fractional position on the rubric: the probability-weighted mean index.
    score: reported.reduce((s, p, i) => s + p * i, 0),
    probabilities,
    legend,
    confidence: peakedness(reported),
  };
}
