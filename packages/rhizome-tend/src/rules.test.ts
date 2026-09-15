import { describe, expect, it } from 'vitest';
import { accrualRate, proposeState, THRESHOLDS, type Signals } from './rules.ts';

const signals = (over: Partial<Signals> = {}): Signals => ({
  slug: 'node',
  currentState: 'seedling',
  ageDays: 200,
  quietDays: 200,
  inDegree: 4,
  outDegree: 3,
  inDegreeDelta: 0,
  corpusDelta: 5,
  windowDays: 120,
  ...over,
});

describe('accrualRate', () => {
  it('is links gained per node the corpus gained', () => {
    expect(accrualRate(signals({ inDegreeDelta: 3, corpusDelta: 6 }))).toBe(0.5);
  });

  it('is null rather than zero when the corpus did not grow', () => {
    // A missing denominator, not a stagnant node: nothing could have linked in.
    expect(accrualRate(signals({ inDegreeDelta: 0, corpusDelta: 0 }))).toBeNull();
  });
});

describe('proposeState', () => {
  it('calls a young sparsely-linked node a seedling', () => {
    const p = proposeState(signals({ ageDays: 2, quietDays: 1, inDegree: 1 }));
    expect(p.to).toBe('seedling');
  });

  it('prefers seedling over germinating for a brand new node', () => {
    // A day-old node has by definition just been edited; without the ordering
    // the germinating test would swallow every new file.
    const p = proposeState(signals({ ageDays: 1, quietDays: 0, inDegree: 0 }));
    expect(p.to).toBe('seedling');
  });

  it('calls a new node that arrived already woven in germinating', () => {
    const p = proposeState(
      signals({ ageDays: 1, quietDays: 1, inDegree: THRESHOLDS.seedlingInDegree }),
    );
    expect(p.to).toBe('germinating');
  });

  it('calls recent prose edits germinating', () => {
    const p = proposeState(signals({ quietDays: 10 }));
    expect(p.to).toBe('germinating');
    expect(p.because).toMatch(/prose edited/);
  });

  it('calls a quiet node that gained inbound links germinating', () => {
    const p = proposeState(signals({ quietDays: 200, inDegreeDelta: 2 }));
    expect(p.to).toBe('germinating');
    expect(p.because).toMatch(/gained 2 inbound/);
  });

  it('fossilises a silent node the corpus grew past', () => {
    const p = proposeState(
      signals({ quietDays: 400, inDegreeDelta: 0, corpusDelta: 6 }),
    );
    expect(p.to).toBe('fossil');
  });

  it('withholds fossil when the corpus barely grew', () => {
    // Flat in-degree during a quiet month is the author's silence, not the
    // node's decay.
    const p = proposeState(
      signals({ quietDays: 400, inDegreeDelta: 0, corpusDelta: 1 }),
    );
    expect(p.to).toBe('stable');
    expect(p.because).toMatch(/too little to read decay/);
  });

  it('calls a settled node stable without the withheld-evidence caveat', () => {
    const p = proposeState(signals({ quietDays: 100, corpusDelta: 1 }));
    expect(p.to).toBe('stable');
    expect(p.because).not.toMatch(/too little to read decay/);
  });

  it('flags whether the proposal differs from the current state', () => {
    const settled = { quietDays: 100, corpusDelta: 1 } as const;
    expect(proposeState(signals({ ...settled, currentState: 'seedling' })).changed).toBe(true);
    expect(proposeState(signals({ ...settled, currentState: 'stable' })).changed).toBe(false);
  });
});
