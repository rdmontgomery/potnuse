import { describe, expect, it } from 'vitest';
import {
  abstainBand,
  brier,
  calibratedJev,
  type ChoiceQuestion,
  ece,
  evaluate,
  murphy,
  type Pair,
  QuestionError,
  shapeOnlyJev,
  sweep,
  threshold,
  validate,
} from './index.ts';

const questions = {
  urgent: { type: 'boolean', instructions: 'Does this convey urgency?' },
  team: {
    type: 'choice',
    instructions: 'Which team should handle this?',
    criteria: {
      billing: 'Payments, invoicing, refunds',
      technical: 'Bugs, outages, integrations',
      sales: null,
    },
  },
  anger: {
    type: 'score',
    instructions: 'How frustrated is the customer?',
    criteria: ['Calm', 'Frustrated', 'Very angry'],
  },
} as const;

const states = Array.from(
  { length: 8000 },
  (_, i) => `ticket ${i}: payouts have been failing for ${i % 9} days`,
);

async function stream(mock: ReturnType<typeof calibratedJev>, id?: string): Promise<Pair[]> {
  for (const s of states) await mock.decide(s, questions);
  return mock.log.filter((o) => !id || o.questionId === id).map((o) => o.pair);
}

describe('protocol', () => {
  it('rejects a one-level rubric before anything is sent', () => {
    expect(() =>
      validate({ q: { type: 'score', instructions: 'How angry?', criteria: ['Furious'] } }),
    ).toThrow(QuestionError);
  });

  it('rejects a single-option choice', () => {
    const q: ChoiceQuestion = {
      type: 'choice',
      instructions: 'Which team?',
      criteria: { billing: null },
    };
    expect(() => validate({ q })).toThrow(/2\.\.255/);
  });

  it('prices output at zero', async () => {
    const { usage } = await shapeOnlyJev().decide('hello', questions);
    expect(usage.output_tokens).toBe(0);
    expect(usage.input_tokens).toBeGreaterThan(0);
  });
});

describe('shape-only mock', () => {
  it('returns the right answer type for every question type', async () => {
    const { answers } = await shapeOnlyJev({ seed: 7 }).decide('a ticket', questions);
    expect(answers.urgent.probability).toBeGreaterThanOrEqual(0);
    expect(Object.keys(answers.team.probabilities)).toEqual(['billing', 'technical', 'sales']);
    expect(answers.team.choice).toBeOneOf(['billing', 'technical', 'sales']);
    expect(answers.anger.score).toBeGreaterThanOrEqual(0);
    expect(answers.anger.score).toBeLessThanOrEqual(2);
  });

  it('is deterministic for the same state and seed', async () => {
    const a = await shapeOnlyJev({ seed: 3 }).decide('same', questions);
    const b = await shapeOnlyJev({ seed: 3 }).decide('same', questions);
    expect(a.answers).toEqual(b.answers);
  });

  it('is not calibrated, which is the whole point of the other mock', async () => {
    // A uniform random probability carries no information about the outcome, so
    // its reliability gap is large no matter how pretty the JSON looks.
    const mock = shapeOnlyJev({ seed: 11 });
    const pairs: Pair[] = [];
    for (const s of states.slice(0, 2000)) {
      const { answers } = await mock.decide(s, { urgent: questions.urgent });
      // Truth is independent of the forecast here — that is the defect.
      pairs.push({ p: answers.urgent.probability, y: Math.random() < 0.5 ? 1 : 0 });
    }
    expect(ece(pairs)).toBeGreaterThan(0.15);
  });
});

describe('calibrated mock', () => {
  it('emits a calibrated boolean stream', async () => {
    const pairs = await stream(calibratedJev({ seed: 42 }), 'urgent');
    expect(pairs.length).toBe(states.length);
    // ECE has a finite-sample noise floor of roughly 1/sqrt(n per bin): ~0.05 at
    // n=500, ~0.01 at n=8000. A perfectly calibrated stream still scores above
    // zero, which is why an absolute ECE is meaningless without the sample size.
    expect(ece(pairs)).toBeLessThan(0.02);
    const m = murphy(pairs);
    expect(m.reliability).toBeLessThan(0.005);
    // And informative, not just honest: resolution well above zero.
    expect(m.resolution).toBeGreaterThan(0.1);
    // The decomposition reconstructs the score, up to the within-bin forecast
    // variance that equal-width binning throws away (order 1e-4 here).
    expect(Math.abs(m.brier - brier(pairs))).toBeLessThan(1e-3);
  });

  it('emits calibrated top-1 probabilities for choice and score', async () => {
    const mock = calibratedJev({ seed: 5 });
    for (const s of states) await mock.decide(s, questions);
    for (const id of ['team', 'anger']) {
      const pairs = mock.log.filter((o) => o.questionId === id).map((o) => o.pair);
      expect(ece(pairs), id).toBeLessThan(0.03);
    }
  });

  it('breaks calibration on demand, and the metric notices', async () => {
    const honest = await stream(calibratedJev({ seed: 42 }), 'urgent');
    const hot = await stream(calibratedJev({ seed: 42, temperature: 0.5 }), 'urgent');
    const cold = await stream(calibratedJev({ seed: 42, temperature: 2.5 }), 'urgent');
    // Unmistakable on the reliability term: two orders of magnitude.
    expect(ece(hot)).toBeGreaterThan(5 * ece(honest));
    expect(ece(cold)).toBeGreaterThan(5 * ece(honest));
    expect(murphy(hot).reliability).toBeGreaterThan(10 * murphy(honest).reliability);
    expect(murphy(cold).reliability).toBeGreaterThan(10 * murphy(honest).reliability);

    // And invisible on resolution. Every distortion here is a monotone map on
    // the forecast, so the ranking of items is untouched and discrimination
    // barely moves. Any objective defined over *orderings* — a pairwise
    // preference loss, for instance — cannot see the thing that just broke.
    for (const s of [hot, cold]) {
      expect(murphy(s).resolution).toBeCloseTo(murphy(honest).resolution, 1);
    }
  });
});

describe('policy', () => {
  it('derives the threshold from the cost matrix', () => {
    expect(threshold({ falsePositive: 1, falseNegative: 1 })).toBeCloseTo(0.5);
    expect(threshold({ falsePositive: 1, falseNegative: 10 })).toBeCloseTo(1 / 11);
  });

  it('collapses the abstain band when a person costs more than the mistakes', () => {
    const cheap = abstainBand({ falsePositive: 20, falseNegative: 20, escalation: 1 });
    expect(cheap.degenerate).toBe(false);
    const dear = abstainBand({ falsePositive: 2, falseNegative: 2, escalation: 5 });
    expect(dear.degenerate).toBe(true);
  });

  it('matches the empirical sweep on a calibrated stream', async () => {
    // The claim under test: when the probability is honest, the closed-form
    // threshold is as good as grid-searching on labelled data — so you do not
    // need the labelled data.
    const pairs = await stream(calibratedJev({ seed: 9 }), 'urgent');
    const costs = { falsePositive: 1, falseNegative: 4 };
    const derived = evaluate(pairs, costs, {
      lo: threshold(costs),
      hi: threshold(costs),
      degenerate: true,
    });
    const searched = sweep(pairs, costs);
    expect(derived.costPerItem).toBeLessThan(searched.costPerItem * 1.05);
  });

  it('loses money when the same band meets an overconfident model', async () => {
    const costs = { falsePositive: 5, falseNegative: 20, escalation: 1 };
    const band = abstainBand(costs);
    const honest = evaluate(await stream(calibratedJev({ seed: 13 }), 'urgent'), costs, band);
    const hot = evaluate(
      await stream(calibratedJev({ seed: 13, temperature: 0.4 }), 'urgent'),
      costs,
      band,
    );
    // Same policy, same items, same latent truths. The only change is that the
    // model's confidence runs hot, and the band stops escalating the items it
    // should have escalated.
    expect(hot.escalationRate).toBeLessThan(honest.escalationRate);
    expect(hot.costPerItem).toBeGreaterThan(honest.costPerItem);
  });
});
