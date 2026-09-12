import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Fill, Intent, Mark } from './types.ts';
import type { PoolState } from './fills.ts';
import type { BankrollState } from './bankroll.ts';
import type { PositionState } from './ladder.ts';

/**
 * Append-only record of everything the system saw and did.
 *
 * This is the actual deliverable of a paper week. The P&L number is nearly
 * uninformative at this sample size — a handful of trades on a fat-tailed
 * payoff tells you almost nothing about edge. What the journal gives you
 * instead is the counterfactual: the same tape replayed against a different
 * plan. That is a real comparison, and it is only possible because the engine
 * is pure and every input was written down.
 */
export type JournalEvent =
  | { kind: 'session'; t: number; note: string; config: unknown }
  | { kind: 'mark'; t: number; market: string; mark: Mark; pool: PoolState }
  | { kind: 'screen'; t: number; market: string; verdict: unknown }
  | { kind: 'proposal'; t: number; market: string; decision: unknown }
  | { kind: 'intent'; t: number; market: string; intent: Intent }
  | { kind: 'fill'; t: number; market: string; fill: Fill; position: PositionState }
  | { kind: 'stall'; t: number; market: string; reason: string }
  | { kind: 'bankroll'; t: number; state: BankrollState }
  | { kind: 'note'; t: number; market: string | null; text: string };

const BIGINT_TAG = '$bigint';

/**
 * Quantities are bigints and JSON has no such thing. Tag them rather than
 * stringifying, so a replayed journal round-trips to exactly the values that
 * produced it — otherwise a "replay" is a different run wearing its clothes.
 */
function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? { [BIGINT_TAG]: value.toString() } : value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && BIGINT_TAG in value) {
    return BigInt((value as Record<string, string>)[BIGINT_TAG]!);
  }
  return value;
}

export function encodeEvent(event: JournalEvent): string {
  return JSON.stringify(event, replacer);
}

export function decodeEvent(line: string): JournalEvent {
  return JSON.parse(line, reviver) as JournalEvent;
}

export interface Journal {
  write(event: JournalEvent): Promise<void>;
  readonly events: readonly JournalEvent[];
}

/** In-memory journal, for tests and dry runs. */
export function memoryJournal(): Journal {
  const events: JournalEvent[] = [];
  return {
    events,
    async write(event) {
      // Round-trip on the way in so a serialisation bug surfaces during the
      // paper week rather than when the log is finally read back.
      events.push(decodeEvent(encodeEvent(event)));
    },
  };
}

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

export interface Summary {
  marks: number;
  intents: number;
  fills: number;
  stalls: number;
  realizedUsd: number;
  /** Fills where the realised price was worse than the observed mark, in bps. */
  meanSlippageBps: number;
}

/**
 * Read a run back. `meanSlippageBps` is the number to look at first: if the
 * paper run's slippage is implausibly small, the fill model is flattering you
 * and none of the rest of the summary means anything.
 */
export function summarize(events: readonly JournalEvent[]): Summary {
  let marks = 0;
  let intents = 0;
  let stalls = 0;
  let realizedUsd = 0;
  const slippage: number[] = [];

  for (const event of events) {
    if (event.kind === 'mark') marks += 1;
    else if (event.kind === 'intent') intents += 1;
    else if (event.kind === 'stall') stalls += 1;
    else if (event.kind === 'fill') slippage.push(event.fill.slippageBps);
    else if (event.kind === 'bankroll') realizedUsd = event.state.realizedUsd;
  }

  return {
    marks,
    intents,
    fills: slippage.length,
    stalls,
    realizedUsd,
    meanSlippageBps: slippage.length
      ? slippage.reduce((sum, bps) => sum + bps, 0) / slippage.length
      : 0,
  };
}
