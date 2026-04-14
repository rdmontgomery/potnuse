import { useRef, useCallback } from 'react';
import { useAppStore } from './useAppStore';
import { getAudioCtx, startTone, playTone } from './audio';
import { ACCORDION_NOTES } from './accordion';
import type { BellowsDir, Song } from './types';

export function useAudio() {
  const stopToneRef = useRef<(() => void) | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const demoTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const demoRafRef = useRef<number | null>(null);

  const { setDetectedNote, setDemoNote, setHoldProgress, setLastHoldDuration, setTimingResult, setIsPlaying, setTrackPosition } = useAppStore.getState();

  const handlePointerDown = useCallback((button: number, dir: BellowsDir) => {
    const btn = ACCORDION_NOTES.find(b => b.button === button);
    if (!btn) return;

    const info = btn[dir];
    const ctx = getAudioCtx();

    if (stopToneRef.current) stopToneRef.current();
    stopToneRef.current = startTone(info.freq, ctx);
    setDetectedNote({ button, dir, note: info.note, freq: info.freq, dist: 0 });
    useAppStore.getState().setBellows(dir);

    holdStartRef.current = performance.now();
    setHoldProgress(0);
    setTimingResult(null);

    const animate = () => {
      if (!holdStartRef.current) return;
      setHoldProgress(performance.now() - holdStartRef.current);
      holdRafRef.current = requestAnimationFrame(animate);
    };
    holdRafRef.current = requestAnimationFrame(animate);
  }, [setDetectedNote, setHoldProgress, setTimingResult]);

  const handlePointerUp = useCallback(() => {
    if (stopToneRef.current) { stopToneRef.current(); stopToneRef.current = null; }
    if (holdRafRef.current) { cancelAnimationFrame(holdRafRef.current); holdRafRef.current = null; }

    const duration = holdStartRef.current ? performance.now() - holdStartRef.current : 0;
    holdStartRef.current = null;
    setLastHoldDuration(duration);

    setTimeout(() => { setDetectedNote(null); setHoldProgress(0); }, 150);
  }, [setDetectedNote, setHoldProgress, setLastHoldDuration]);

  const playDemo = useCallback((song: Song) => {
    if (useAppStore.getState().isPlaying) return;
    setIsPlaying(true);
    setTrackPosition(0);

    const ctx = getAudioCtx();
    demoTimeoutsRef.current.forEach(t => clearTimeout(t));
    demoTimeoutsRef.current = [];
    if (demoRafRef.current) cancelAnimationFrame(demoRafRef.current);

    // Pre-compute start times and total duration
    const startTimes: number[] = [];
    let total = 0;
    for (const n of song.notes) {
      startTimes.push(total);
      total += n.duration;
    }

    // Schedule audio + demoNote per note
    let delay = 0;
    song.notes.forEach((n, i) => {
      const btn = ACCORDION_NOTES.find(b => b.button === n.button);
      if (!btn) return;
      const info = btn[n.dir];

      const t1 = setTimeout(() => {
        playTone(info.freq, n.duration * 0.9, ctx);
        setDemoNote({ button: n.button, dir: n.dir, note: info.note, freq: info.freq, dist: 0 });
        const t2 = setTimeout(() => setDemoNote(null), n.duration * 0.8);
        demoTimeoutsRef.current.push(t2);
      }, delay);
      demoTimeoutsRef.current.push(t1);
      delay += n.duration;
    });

    // Drive trackPosition smoothly via rAF
    const demoStart = performance.now();
    const tick = (now: number) => {
      const elapsed = now - demoStart;
      setTrackPosition(elapsed);
      if (elapsed < total) {
        demoRafRef.current = requestAnimationFrame(tick);
      } else {
        // Demo finished — hold briefly, then clean up
        setTrackPosition(total);
        const t3 = setTimeout(() => {
          setIsPlaying(false);
          setDemoNote(null);
          setTrackPosition(0);
        }, 400);
        demoTimeoutsRef.current.push(t3);
      }
    };
    demoRafRef.current = requestAnimationFrame(tick);
  }, [setDemoNote, setIsPlaying, setTrackPosition]);

  const stopDemo = useCallback(() => {
    demoTimeoutsRef.current.forEach(t => clearTimeout(t));
    demoTimeoutsRef.current = [];
    if (demoRafRef.current) { cancelAnimationFrame(demoRafRef.current); demoRafRef.current = null; }
    setIsPlaying(false);
    setDemoNote(null);
    setTrackPosition(0);
  }, [setDemoNote, setIsPlaying, setTrackPosition]);

  return { handlePointerDown, handlePointerUp, playDemo, stopDemo };
}
