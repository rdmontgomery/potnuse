/**
 * State proposal.
 *
 * The ladder encodes *tending*, not age. Age already has a channel — the
 * temporal field on /rhizome renders it directly — so a state derived from age
 * would be a second view of one variable. What state adds is whether the
 * rhizome is still growing into a node.
 *
 * The order parameter is inbound-link accrual normalised by corpus growth: a
 * node is settled if its in-degree keeps pace as the corpus expands, and
 * fossilised if it flatlines while everything around it grows. Nothing here
 * reads content — that is the agent's job, and it may override any of this.
 */

import type { NodeState } from './graph.ts';

export interface Signals {
  slug: string;
  currentState: NodeState;
  /** Days since the file first appeared in git (or its frontmatter date). */
  ageDays: number;
  /** Days since the last commit that changed prose rather than frontmatter. */
  quietDays: number;
  inDegree: number;
  outDegree: number;
  /** Inbound links gained over the observation window. */
  inDegreeDelta: number;
  /** Nodes the whole corpus gained over the same window. */
  corpusDelta: number;
  windowDays: number;
}

export interface Thresholds {
  /** Below this age a sparsely-linked node is still just planted. */
  seedlingDays: number;
  /**
   * In-degree at which a new node counts as already woven in. Inbound links to
   * a fresh node mean older nodes were edited to point at it — that is the
   * rhizome growing, so such a node is germinating, not seedling.
   */
  seedlingInDegree: number;
  /** Prose edited this recently means active work. */
  germinatingQuietDays: number;
  /** Silence this long is a precondition for fossil, never sufficient alone. */
  fossilQuietDays: number;
  /**
   * The corpus must have grown by at least this much for a flat in-degree to
   * mean anything. Without growth there was nothing to link from, and calling
   * the node fossilised would blame it for the author's quiet month.
   */
  fossilCorpusGrowth: number;
}

export const THRESHOLDS: Thresholds = {
  seedlingDays: 30,
  seedlingInDegree: 3,
  germinatingQuietDays: 60,
  fossilQuietDays: 180,
  fossilCorpusGrowth: 2,
};

export interface Proposal {
  slug: string;
  from: NodeState;
  to: NodeState;
  changed: boolean;
  because: string;
  /** Inbound links gained per node the corpus gained; null when it did not grow. */
  accrual: number | null;
}

/**
 * Inbound links gained per node the corpus gained.
 *
 * Null when the corpus did not grow. That is a missing denominator, not a zero
 * rate — reporting 0 there would call a node stagnant during a month when
 * nothing could have linked to anything.
 */
export function accrualRate(signals: Signals): number | null {
  if (signals.corpusDelta <= 0) return null;
  return signals.inDegreeDelta / signals.corpusDelta;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function proposeState(
  signals: Signals,
  thresholds: Thresholds = THRESHOLDS,
): Proposal {
  const accrual = accrualRate(signals);
  const base = { slug: signals.slug, from: signals.currentState, accrual };
  const decide = (to: NodeState, because: string): Proposal => ({
    ...base,
    to,
    changed: to !== signals.currentState,
    because,
  });

  // Seedling first: a day-old node has by definition just been edited, so the
  // germinating test would otherwise swallow every new file.
  if (
    signals.ageDays <= thresholds.seedlingDays &&
    signals.inDegree < thresholds.seedlingInDegree
  ) {
    return decide(
      'seedling',
      `${Math.round(signals.ageDays)}d old, ${signals.inDegree} inbound — planted, not yet woven in`,
    );
  }

  if (signals.quietDays <= thresholds.germinatingQuietDays) {
    return decide(
      'germinating',
      `prose edited ${Math.round(signals.quietDays)}d ago`,
    );
  }

  if (signals.inDegreeDelta > 0) {
    return decide(
      'germinating',
      `gained ${signals.inDegreeDelta} inbound in ${signals.windowDays}d` +
        (accrual === null ? '' : ` (accrual ${round(accrual)})`),
    );
  }

  if (
    signals.quietDays >= thresholds.fossilQuietDays &&
    signals.inDegreeDelta === 0 &&
    signals.corpusDelta >= thresholds.fossilCorpusGrowth
  ) {
    return decide(
      'fossil',
      `silent ${Math.round(signals.quietDays)}d while the corpus grew by ${signals.corpusDelta}, no new inbound`,
    );
  }

  // Quiet long enough to be a fossil, but the corpus did not grow enough for
  // the flat in-degree to mean anything. Say so rather than implying the node
  // was judged healthy — this is withheld evidence, not a clean bill.
  if (signals.quietDays >= thresholds.fossilQuietDays) {
    return decide(
      'stable',
      `silent ${Math.round(signals.quietDays)}d, but the corpus grew by only ` +
        `${signals.corpusDelta} in ${signals.windowDays}d — too little to read decay`,
    );
  }

  return decide(
    'stable',
    `quiet ${Math.round(signals.quietDays)}d, ${signals.inDegree} inbound holding`,
  );
}
