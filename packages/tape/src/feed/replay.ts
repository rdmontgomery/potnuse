import type { Market } from '../types.ts';
import type { MarkFeed, Observation } from './types.ts';

/**
 * Replay observations recorded earlier.
 *
 * This is what the paper week buys you: the same tape run against a different
 * ladder, so plan changes can be argued from evidence instead of from how last
 * week felt. Exhaustion returns null rather than throwing, so a runner drains
 * a tape the same way it handles a feed that went quiet.
 */
export function replayFeed(market: Market, observations: Observation[]): MarkFeed {
  let index = 0;
  return {
    market,
    async poll(): Promise<Observation | null> {
      const next = observations[index];
      if (next === undefined) return null;
      index += 1;
      return next;
    },
  };
}
