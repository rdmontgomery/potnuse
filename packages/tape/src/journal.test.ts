import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PoolState } from './fills.ts';
import {
  decodeEvent,
  encodeEvent,
  memoryJournal,
  summarize,
  type JournalEvent,
} from './journal.ts';
import { fileJournal, readJournal } from './node.ts';

const fill: JournalEvent = {
  kind: 'fill',
  t: 5,
  market: '0xpool',
  fill: {
    side: 'sell',
    qtyBase: 123_456_789_012_345_678_901n,
    qtyQuote: 987_654_321n,
    effectivePrice: 0.1234,
    slippageBps: 42,
    feeBps: 100,
    t: 5,
  },
  position: {
    entryBasis: 0.1,
    qtyOriginal: 1_000_000_000_000_000_000_000n,
    qtyOpen: 600_000_000_000_000_000_000n,
    rungsFilled: [true, false],
    highWater: 0.25,
    trailArmed: true,
    openedAt: 0,
    closedAt: null,
  },
};

describe('serialisation', () => {
  it('round-trips bigint quantities exactly', () => {
    const decoded = decodeEvent(encodeEvent(fill));
    expect(decoded).toEqual(fill);
  });

  it('does not quietly turn a bigint into a number', () => {
    const decoded = decodeEvent(encodeEvent(fill)) as typeof fill;
    expect(typeof decoded.fill.qtyBase).toBe('bigint');
    // A float would have lost the low digits, which is exactly the kind of
    // drift that makes a replay disagree with the run it claims to reproduce.
    expect(decoded.fill.qtyBase).toBe(123_456_789_012_345_678_901n);
  });

  it('writes one self-contained line per event', () => {
    expect(encodeEvent(fill)).not.toContain('\n');
  });
});

describe('journals', () => {
  it('round-trips every event through memory', async () => {
    const journal = memoryJournal();
    await journal.write(fill);
    expect(journal.events).toEqual([fill]);
  });

  it('appends to disk and reads back identically', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tape-'));
    const path = join(dir, 'nested', 'run.jsonl');
    const journal = await fileJournal(path);

    await journal.write({ kind: 'note', t: 0, market: null, text: 'open' });
    await journal.write(fill);

    expect((await readFile(path, 'utf8')).trim().split('\n')).toHaveLength(2);
    expect(await readJournal(path)).toEqual([
      { kind: 'note', t: 0, market: null, text: 'open' },
      fill,
    ]);
  });
});

const pool: PoolState = {
  reserveBase: 1_000n,
  reserveQuote: 100n,
  baseDecimals: 18,
  quoteDecimals: 6,
};

describe('summary', () => {
  it('counts what happened and averages realised slippage', () => {
    const events: JournalEvent[] = [
      { kind: 'mark', t: 0, market: '0xp', mark: { t: 0, quotePerBase: 1, usdPerQuote: 1 }, pool },
      { kind: 'stall', t: 1, market: '0xp', reason: 'no reference' },
      fill,
      { ...fill, fill: { ...fill.fill, slippageBps: 58 } },
      {
        kind: 'bankroll',
        t: 9,
        state: { deployedUsd: 0, committedUsd: 50, realizedUsd: 130, openCount: 0, burned: {}, lastLossAt: null },
      },
    ];
    expect(summarize(events)).toEqual({
      marks: 1,
      intents: 0,
      fills: 2,
      stalls: 1,
      realizedUsd: 130,
      meanSlippageBps: 50,
    });
  });

  it('reports zero slippage for a run that never filled, rather than NaN', () => {
    expect(summarize([]).meanSlippageBps).toBe(0);
  });
});
