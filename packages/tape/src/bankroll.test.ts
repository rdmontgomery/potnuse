import { describe, expect, it } from 'vitest';
import {
  makeBankroll,
  maxDrawdownUsd,
  openBankroll,
  proposeEntry,
  recordEntry,
  recordExit,
  slotSize,
  type BankrollConfig,
} from './bankroll.ts';
import type { Address } from './types.ts';

const A: Address = '0x2e8c31162b855a2ffa90f6f8634643ad6f111e18';
const B: Address = '0x00000000000000000000000000000000000000bb';

const config: BankrollConfig = makeBankroll({
  programBudgetUsd: 500,
  slots: 10,
  cooldownAfterLossMs: 60 * 60_000,
});

const HOUR = 60 * 60_000;

describe('sizing', () => {
  it('cuts the budget into equal tickets', () => {
    expect(slotSize(config, openBankroll())).toBe(50);
  });

  it('does not enlarge the ticket after a win, by default', () => {
    // The usual way a working strategy dies.
    let state = openBankroll();
    state = recordEntry(state, 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 900, t: 1 });
    expect(slotSize(config, state)).toBe(50);
  });

  it('scales with equity only when explicitly asked to', () => {
    const compounding = makeBankroll({ ...config, sizing: 'fixed-fractional' });
    let state = openBankroll();
    state = recordEntry(state, 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 550, t: 1 });
    expect(slotSize(compounding, state)).toBe(100);
  });

  it('never proposes a ticket larger than the remaining budget', () => {
    let state = openBankroll();
    for (let i = 0; i < 9; i += 1) state = recordEntry(state, 50);
    state = { ...state, openCount: 0, committedUsd: 480 };
    const decision = proposeEntry(config, state, { asset: B, t: 0 });
    expect(decision).toEqual({ allowed: true, sizeUsd: 20 });
  });
});

describe('refusals', () => {
  it('allows a clean first entry', () => {
    expect(proposeEntry(config, openBankroll(), { asset: A, t: 0 })).toEqual({
      allowed: true,
      sizeUsd: 50,
    });
  });

  it('permanently refuses an asset that has already taken money', () => {
    let state = recordEntry(openBankroll(), 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 12, t: 0 });
    const decision = proposeEntry(config, state, { asset: A, t: 100 * HOUR });
    expect(decision).toMatchObject({ allowed: false, reason: 'already-lost-here' });
  });

  it('ignores address casing when refusing a re-up', () => {
    let state = recordEntry(openBankroll(), 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 0, t: 0 });
    const shouted = A.toUpperCase().replace('0X', '0x') as Address;
    expect(proposeEntry(config, state, { asset: shouted, t: 100 * HOUR })).toMatchObject({
      allowed: false,
      reason: 'already-lost-here',
    });
  });

  it('does not burn an asset that closed at a profit', () => {
    let state = recordEntry(openBankroll(), 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 80, t: 0 });
    expect(state.burned).toEqual({});
  });

  it('holds the line for the cooldown after a loss, then releases', () => {
    let state = recordEntry(openBankroll(), 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 10, t: 0 });
    expect(proposeEntry(config, state, { asset: B, t: HOUR / 2 })).toMatchObject({
      allowed: false,
      reason: 'cooling-off',
    });
    expect(proposeEntry(config, state, { asset: B, t: HOUR })).toMatchObject({ allowed: true });
  });

  it('does not start a cooldown after a win', () => {
    let state = recordEntry(openBankroll(), 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 400, t: 0 });
    expect(proposeEntry(config, state, { asset: B, t: 1 })).toMatchObject({ allowed: true });
  });

  it('refuses once every concurrent slot is taken', () => {
    const capped = makeBankroll({ ...config, maxConcurrent: 3 });
    let state = openBankroll();
    for (let i = 0; i < 3; i += 1) state = recordEntry(state, 50);
    expect(proposeEntry(capped, state, { asset: B, t: 0 })).toMatchObject({
      allowed: false,
      reason: 'slots-full',
    });
  });

  it('ends the program when the budget is fully committed, wins notwithstanding', () => {
    let state = openBankroll();
    for (let i = 0; i < 10; i += 1) {
      state = recordEntry(state, 50);
      state = recordExit(state, {
        asset: `0x${i.toString().padStart(40, '0')}` as Address,
        costUsd: 50,
        proceedsUsd: 300,
        t: i,
      });
    }
    expect(state.realizedUsd).toBe(2500);
    expect(proposeEntry(config, state, { asset: B, t: 100 * HOUR })).toMatchObject({
      allowed: false,
      reason: 'budget-exhausted',
    });
  });
});

describe('exposure', () => {
  it('reports the worst case as everything open going to zero', () => {
    let state = recordEntry(openBankroll(), 50);
    state = recordEntry(state, 50);
    expect(maxDrawdownUsd(state)).toBe(100);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 200, t: 1 });
    // One slot left at risk, against 150 already banked.
    expect(maxDrawdownUsd(state)).toBe(-100);
  });

  it('keeps committed capital monotonic as positions close', () => {
    let state = recordEntry(openBankroll(), 50);
    state = recordExit(state, { asset: A, costUsd: 50, proceedsUsd: 500, t: 1 });
    expect(state.committedUsd).toBe(50);
    expect(state.deployedUsd).toBe(0);
  });
});
