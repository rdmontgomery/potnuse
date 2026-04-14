import { autoCorrelate, freqToAccordionNote } from './pitchUtils';
import type { DetectedNote } from './types';

interface WorkerInput {
  buffer: Float32Array;
  sampleRate: number;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { buffer, sampleRate } = e.data;
  const freq = autoCorrelate(buffer, sampleRate);
  const note: DetectedNote | null = freq > 0 ? freqToAccordionNote(freq) : null;
  self.postMessage(note);
};
