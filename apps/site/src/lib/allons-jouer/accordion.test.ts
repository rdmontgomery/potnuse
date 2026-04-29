import { describe, it, expect } from 'vitest';
import { ACCORDION_NOTES, getButtonInfo } from './accordion';

describe('ACCORDION_NOTES', () => {
  it('has 10 buttons numbered 1–10', () => {
    expect(ACCORDION_NOTES).toHaveLength(10);
    expect(ACCORDION_NOTES.map(b => b.button)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('every button has push and pull with note and positive freq', () => {
    for (const btn of ACCORDION_NOTES) {
      expect(btn.push.note).toMatch(/^[A-G]#?\d$/);
      expect(btn.push.freq).toBeGreaterThan(0);
      expect(btn.pull.note).toMatch(/^[A-G]#?\d$/);
      expect(btn.pull.freq).toBeGreaterThan(0);
    }
  });
});

describe('getButtonInfo', () => {
  it('returns button 1 with E4 push', () => {
    const btn = getButtonInfo(1);
    expect(btn?.push.note).toBe('E4');
  });

  it('returns undefined for out-of-range button', () => {
    expect(getButtonInfo(0)).toBeUndefined();
    expect(getButtonInfo(11)).toBeUndefined();
  });
});
