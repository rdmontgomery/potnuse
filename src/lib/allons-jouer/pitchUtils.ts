import { ACCORDION_NOTES } from './accordion';
import type { DetectedNote, TimingResult } from './types';

export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = size - 1;
  for (let i = 0; i < size / 2; i++) { if (Math.abs(buf[i]) < 0.2) { r1 = i; break; } }
  for (let i = 1; i < size / 2; i++) { if (Math.abs(buf[size - i]) < 0.2) { r2 = size - i; break; } }

  const sliced = buf.slice(r1, r2);
  const len = sliced.length;
  const c = new Array(len).fill(0);
  for (let i = 0; i < len; i++) for (let j = 0; j < len - i; j++) c[i] += sliced[j] * sliced[j + i];

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxVal = -1, maxPos = -1;
  for (let i = d; i < len; i++) { if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; } }
  if (maxPos === -1) return -1;

  let T0 = maxPos;
  const x1 = c[T0 - 1] ?? 0, x2 = c[T0], x3 = c[T0 + 1] ?? 0;
  const aa = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (aa) T0 -= bb / (2 * aa);

  return sampleRate / T0;
}

export function freqToAccordionNote(freq: number): DetectedNote | null {
  if (freq < 200 || freq > 2200) return null;

  let closest: DetectedNote | null = null;
  let minDist = Infinity;

  for (const btn of ACCORDION_NOTES) {
    for (const dir of ['push', 'pull'] as const) {
      const dist = Math.abs(Math.log2(freq / btn[dir].freq)) * 12;
      if (dist < minDist) {
        minDist = dist;
        closest = { button: btn.button, dir, note: btn[dir].note, freq: btn[dir].freq, dist };
      }
    }
  }

  return closest && closest.dist < 1.5 ? closest : null;
}

export function rateDuration(actual: number, target: number, tolerance = 0.4): TimingResult {
  const ratio = actual / target;
  if (ratio >= 1 - tolerance && ratio <= 1 + tolerance) return 'good';
  if (ratio >= 1 - tolerance * 1.8 && ratio <= 1 + tolerance * 1.8) return 'ok';
  return 'off';
}
