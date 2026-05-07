import { useEffect, useState, type RefObject } from 'react';

// Measure how many monospace columns fit in the container's width,
// using a hidden `1ch` probe. Clamps to a sensible band.
export function useColumns(
  ref: RefObject<HTMLElement | null>,
  opts: { min?: number; max?: number } = {},
): number {
  const { min = 28, max = 64 } = opts;
  const [cols, setCols] = useState(38);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const probe = document.createElement('span');
    probe.textContent = 'M';
    probe.style.cssText =
      'position:absolute;visibility:hidden;font:inherit;white-space:pre;';
    el.appendChild(probe);
    const measure = () => {
      const charW = probe.getBoundingClientRect().width || 9;
      const w = el.clientWidth;
      // Subtract a 1-col safety margin so fractional rendering never spills
      // past the edge and triggers an overflow scrollbar.
      const c = Math.floor(w / charW) - 1;
      setCols(Math.max(min, Math.min(max, c)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      probe.remove();
    };
  }, [ref, min, max]);

  return cols;
}
