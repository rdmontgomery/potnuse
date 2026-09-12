import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { decodeEvent, encodeEvent, type Journal, type JournalEvent } from './journal.ts';
import { replayFeed } from './feed/replay.ts';
import type { MarkFeed, Observation } from './feed/types.ts';
import type { Market } from './types.ts';

/**
 * Filesystem-backed journals.
 *
 * Kept out of the package root on purpose. The runner ships to a Worker, where
 * `node:fs` does not exist, and a bundler that follows a root export into this
 * module fails the build — or worse, succeeds and ships a broken path. Reach
 * for these only from the CLI and from tests.
 */
/** JSONL on disk. One file per run; never rewritten, only appended. */
export async function fileJournal(path: string): Promise<Journal> {
  await mkdir(dirname(path), { recursive: true });
  const events: JournalEvent[] = [];
  return {
    events,
    async write(event) {
      events.push(event);
      await appendFile(path, `${encodeEvent(event)}\n`, 'utf8');
    },
  };
}

export async function readJournal(path: string): Promise<JournalEvent[]> {
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(decodeEvent);
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
