import { readJournal } from '../journal.ts';
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

/** Rebuild a feed from a journal written by a previous run. */
export async function replayFromJournal(market: Market, path: string): Promise<MarkFeed> {
  const events = await readJournal(path);
  const observations: Observation[] = [];

  for (const event of events) {
    if (event.kind !== 'mark') continue;
    if (event.market !== market.pool) continue;
    // The pool snapshot is recorded alongside every mark precisely so a replay
    // pays the same impact the live run did. A replay that fills at mid is not
    // a replay, it is a wish.
    observations.push({ mark: event.mark, pool: event.pool });
  }
  return replayFeed(market, observations);
}
