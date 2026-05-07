import { useEffect, type RefObject } from 'react';

// Fires `onDwell` once when the target element has been continuously
// visible (>= ratio in viewport) for `ms` milliseconds. Pauses the timer
// when the page tab isn't visible. Disable with `enabled = false` once
// the consumer has recorded the event so it can't fire twice.
export function useDwell(
  ref: RefObject<HTMLElement | null>,
  ms: number,
  onDwell: () => void,
  opts: { enabled?: boolean; ratio?: number } = {},
): void {
  const { enabled = true, ratio = 0.4 } = opts;
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    let timer: number | null = null;
    let isVisible = false;
    let isFocused = document.visibilityState === 'visible';

    const start = () => {
      if (timer != null) return;
      if (!isVisible || !isFocused) return;
      timer = window.setTimeout(() => {
        onDwell();
      }, ms);
    };
    const stop = () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const obs = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting && entry.intersectionRatio >= ratio;
        if (isVisible) start();
        else stop();
      },
      { threshold: [0, ratio, 1] },
    );
    obs.observe(el);

    const onVis = () => {
      isFocused = document.visibilityState === 'visible';
      if (isFocused) start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      obs.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ref, ms, onDwell, enabled, ratio]);
}
