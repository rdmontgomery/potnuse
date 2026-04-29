import { describe, it, expect } from 'vitest';
import { freqToAccordionNote, rateDuration } from './pitchUtils';

describe('freqToAccordionNote', () => {
  it('identifies C4 (button 2 push) at 261.63 Hz', () => {
    const r = freqToAccordionNote(261.63);
    expect(r).not.toBeNull();
    expect(r!.button).toBe(2);
    expect(r!.dir).toBe('push');
    expect(r!.note).toBe('C4');
  });

  it('identifies A4 (button 3 pull) at 440 Hz', () => {
    const r = freqToAccordionNote(440);
    expect(r?.button).toBe(3);
    expect(r?.dir).toBe('pull');
  });

  it('returns null below 200 Hz', () => {
    expect(freqToAccordionNote(100)).toBeNull();
  });

  it('returns null above 2200 Hz', () => {
    expect(freqToAccordionNote(3000)).toBeNull();
  });

  it('tolerates slight pitch deviation within 1.5 semitones', () => {
    // 265 Hz is close to C4 (261.63 Hz)
    expect(freqToAccordionNote(265)?.note).toBe('C4');
  });

  it('returns null when too far from any note', () => {
    // 1850 Hz lies in the ~5-semitone gap between G6 (1567.98) and C7 (2093.00).
    // Distance to G6 ≈ 2.86 semitones, distance to C7 ≈ 2.13 semitones — both > 1.5.
    expect(freqToAccordionNote(1850)).toBeNull();
  });
});

describe('rateDuration', () => {
  it('good when within 40% of target', () => {
    expect(rateDuration(800, 800)).toBe('good');
    expect(rateDuration(500, 800)).toBe('good');
    expect(rateDuration(1100, 800)).toBe('good');
  });

  it('ok when within ~70% tolerance', () => {
    // 250/800 = 0.3125 (≈69% short) and 1350/800 = 1.6875 (≈69% over):
    // both fall outside the ±40% "good" band but inside the ±72% "ok" band.
    expect(rateDuration(250, 800)).toBe('ok');
    expect(rateDuration(1350, 800)).toBe('ok');
  });

  it('off when very short or very long', () => {
    expect(rateDuration(50, 800)).toBe('off');
    expect(rateDuration(2500, 800)).toBe('off');
  });
});
