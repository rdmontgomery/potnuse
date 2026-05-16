import { useEffect, useRef } from 'react';
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
} from 'vexflow';

// One chord on one staff, rendered straight by VexFlow. The engrave
// helper in lib/pentimento is built around full Song objects with
// separate voices per StaveNote, so it can't draw a true chord; this
// component fills that gap for Module 4 (and any future module that
// wants a chord notated outside the clock's pc-set view).

export interface ChordStaffProps {
  // VexFlow keys, e.g. ['c/4', 'e/4', 'g/4']. Order doesn't matter —
  // VexFlow stacks them on the stave from low to high.
  pitches: readonly string[];
  // Optional roman-numeral or chord-name label printed above the staff.
  label?: string;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

const SOLID_INK = '#1f1408';

export default function ChordStaff({
  pitches,
  label,
  size = 200,
  className,
  ariaLabel = 'chord on staff',
}: ChordStaffProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    if (pitches.length === 0) return;

    const width = size;
    const height = Math.round(size * 0.7);
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    ctx.setFillStyle(SOLID_INK);
    ctx.setStrokeStyle(SOLID_INK);

    // Reserve a comfortable left pad so the clef + brace overhang clears
    // the SVG edge — same margin lesson we learned in pentimento/engrave.
    const padX = 26;
    const padTop = label ? 24 : 14;
    const stave = new Stave(padX, padTop, width - padX * 2);
    stave.addClef('treble');
    stave.setContext(ctx).draw();

    const note = new StaveNote({
      keys: [...pitches],
      duration: 'w',
    });

    // Auto-place accidentals so #/b spellings print on the staff.
    for (let i = 0; i < pitches.length; i++) {
      const head = pitches[i].split('/')[0];
      const accidental = head.includes('#')
        ? '#'
        : head.includes('b') && head.length > 1
          ? 'b'
          : null;
      if (accidental) {
        note.addModifier(new Accidental(accidental), i);
      }
    }

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.addTickables([note]);
    new Formatter().joinVoices([voice]).format([voice], width - padX * 2 - 40);
    voice.draw(ctx, stave);

    if (label) {
      // Manually paint the Roman numeral above the stave so it picks up
      // the page's font + accent color rather than VexFlow's defaults.
      const svg = el.querySelector('svg');
      if (svg) {
        const text = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'text',
        );
        text.setAttribute('x', String(width / 2));
        text.setAttribute('y', '16');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', 'var(--font-jetbrains)');
        text.setAttribute('font-size', '13');
        text.setAttribute('fill', '#b87a1e');
        text.textContent = label;
        svg.appendChild(text);
      }
    }
  }, [pitches, label, size]);

  return (
    <div
      ref={ref}
      className={['chord-staff', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
