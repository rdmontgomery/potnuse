import { useRef, useEffect, useCallback } from 'react';

export function useTrackScroll(active: boolean, onTick: (elapsedMs: number) => void, tempoRatio = 1) {
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const tempoRatioRef = useRef(tempoRatio);
  tempoRatioRef.current = tempoRatio;

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
      return;
    }

    const animate = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      onTickRef.current((now - startRef.current) * tempoRatioRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  const reset = useCallback(() => {
    startRef.current = null;
  }, []);

  return { reset };
}
