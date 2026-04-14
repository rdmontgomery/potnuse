import { useRef, useCallback, useEffect } from 'react';
import { useAppStore } from './useAppStore';
import { getAudioCtx } from './audio';
import type { DetectedNote } from './types';

export function useMic() {
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const { setDetectedNote, setMicError } = useAppStore.getState();

  const startListening = useCallback(async () => {
    try {
      const ctx = getAudioCtx();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

      // webpack / Next.js Web Worker import
      const worker = new Worker(new URL('./pitchDetection.worker.ts', import.meta.url));
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<DetectedNote | null>) => setDetectedNote(e.data);

      setMicError(null);

      const detect = () => {
        if (!analyserRef.current || !bufferRef.current || !workerRef.current) return;
        analyserRef.current.getFloatTimeDomainData(bufferRef.current);
        workerRef.current.postMessage({ buffer: bufferRef.current, sampleRate: ctx.sampleRate });
        rafRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch {
      setMicError('Mic access needed. Check browser permissions.');
    }
  }, [setDetectedNote, setMicError]);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    setDetectedNote(null);
  }, [setDetectedNote]);

  useEffect(() => () => stopListening(), [stopListening]);

  return { startListening, stopListening };
}
