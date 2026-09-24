/**
 * What a calibrated probability actually buys you: the threshold stops being a
 * tuning knob and becomes an algebraic consequence of your cost matrix.
 *
 * With an uncalibrated score, 0.8 means nothing in particular, so you sweep the
 * threshold on a labelled set, pick the elbow, and re-sweep every time the model
 * version moves. With a calibrated probability, the optimal threshold is a
 * closed form in the costs you already know from the business, and it is the
 * same number for every question you ask.
 */

import type { Pair } from './calibration.ts';

export interface Costs {
  /** Cost of acting when you should not have. */
  falsePositive: number;
  /** Cost of not acting when you should have. */
  falseNegative: number;
  /** Cost of handing the item to a person instead. Omit for a no-abstain policy. */
  escalation?: number;
}

export type Action = 'act' | 'reject' | 'escalate';

/**
 * Minimize expected cost with no abstain option. Acting costs (1-p)*cFP;
 * not acting costs p*cFN. Act when the first is smaller:
 *
 *   p > cFP / (cFP + cFN)
 *
 * Symmetric costs give you 0.5. A false negative ten times worse than a false
 * positive gives you 0.09 — and if your score is uncalibrated, 0.09 on it is an
 * arbitrary number with no defensible relation to that ten.
 */
export function threshold(costs: Costs): number {
  return costs.falsePositive / (costs.falsePositive + costs.falseNegative);
}

export interface Band {
  /** Below this, reject outright. */
  lo: number;
  /** Above this, act outright. */
  hi: number;
  /** True when escalation is too expensive to ever be optimal, in which case
   *  lo === hi === threshold(costs). */
  degenerate: boolean;
}

/**
 * Add a human. Escalating costs a flat cE regardless of the truth, so it wins
 * exactly in the middle band where both mistakes are expensive in expectation:
 *
 *   reject  when p * cFN   < cE   ->  p < cE / cFN
 *   act     when (1-p)*cFP < cE   ->  p > 1 - cE / cFP
 *
 * If cE is large enough that those two cross, there is no band: a person costs
 * more than the mistakes they would prevent, and the honest policy is to decide
 * every item in code. That inversion is the number worth showing a skeptical
 * staff engineer, because it is where "add a human in the loop" stops being a
 * virtue and starts being a line item.
 */
export function abstainBand(costs: Costs): Band {
  const cE = costs.escalation;
  if (cE === undefined) {
    const t = threshold(costs);
    return { lo: t, hi: t, degenerate: true };
  }
  const lo = cE / costs.falseNegative;
  const hi = 1 - cE / costs.falsePositive;
  if (lo >= hi) {
    const t = threshold(costs);
    return { lo: t, hi: t, degenerate: true };
  }
  return { lo, hi, degenerate: false };
}

export function decide(p: number, band: Band): Action {
  if (band.degenerate) return p > band.hi ? 'act' : 'reject';
  if (p >= band.hi) return 'act';
  if (p <= band.lo) return 'reject';
  return 'escalate';
}

export interface Outcome {
  n: number;
  acted: number;
  rejected: number;
  escalated: number;
  falsePositives: number;
  falseNegatives: number;
  /** Realized mean cost per item. The only number that settles an argument. */
  costPerItem: number;
  /** Fraction of items handed to a person. Your staffing model. */
  escalationRate: number;
}

/** Run a policy over a scored stream and report what it cost. */
export function evaluate(pairs: readonly Pair[], costs: Costs, band = abstainBand(costs)): Outcome {
  let acted = 0;
  let rejected = 0;
  let escalated = 0;
  let fp = 0;
  let fn = 0;
  let total = 0;

  for (const { p, y } of pairs) {
    const action = decide(p, band);
    if (action === 'act') {
      acted += 1;
      if (y === 0) {
        fp += 1;
        total += costs.falsePositive;
      }
    } else if (action === 'reject') {
      rejected += 1;
      if (y === 1) {
        fn += 1;
        total += costs.falseNegative;
      }
    } else {
      escalated += 1;
      total += costs.escalation ?? 0;
    }
  }

  const n = pairs.length;
  return {
    n,
    acted,
    rejected,
    escalated,
    falsePositives: fp,
    falseNegatives: fn,
    costPerItem: total / n,
    escalationRate: escalated / n,
  };
}

/**
 * Empirical threshold sweep, for comparison. This is what you are forced to do
 * when the score is not calibrated: grid-search on labelled data, take the
 * argmin, and hope the distribution holds.
 */
export function sweep(
  pairs: readonly Pair[],
  costs: Costs,
  steps = 200,
): { threshold: number; costPerItem: number } {
  let best = { threshold: 0, costPerItem: Infinity };
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const out = evaluate(pairs, costs, { lo: t, hi: t, degenerate: true });
    if (out.costPerItem < best.costPerItem) best = { threshold: t, costPerItem: out.costPerItem };
  }
  return best;
}
