import { useEffect, type RefObject } from 'react';

// Scales the font-size of a fixed-width <pre> element so its `naturalCols`
// columns of monospace exactly fit the parent's width. Beats CSS clamp()
// because clamp uses vw, not container width, and so doesn't account for
// padding, sidebars, or zoom.
export function useFit(
  ref: RefObject<HTMLElement | null>,
  naturalCols: number,
  opts: { min?: number; max?: number } = {},
): void {
  const { min = 7, max = 14 } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const probe = document.createElement('span');
    probe.textContent = 'M';
    probe.style.cssText =
      'position:absolute;visibility:hidden;font:inherit;font-size:16px;white-space:pre;';
    el.appendChild(probe);
    const ratio = (probe.getBoundingClientRect().width || 9.6) / 16;
    probe.remove();

    const fit = () => {
      const target = el.parentElement || el;
      // clientWidth includes the parent's padding, so subtract it (children
      // only get the content box). Plus 2px of safety margin so sub-pixel
      // rendering can't push us a fraction of a column past the edge.
      const cs = getComputedStyle(target);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      const usable = Math.max(0, target.clientWidth - padL - padR - 2);
      const desired = Math.floor(usable / naturalCols / ratio);
      const clamped = Math.max(min, Math.min(max, desired));
      el.style.fontSize = `${clamped}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement || el);
    return () => ro.disconnect();
  }, [ref, naturalCols, min, max]);
}
