import { lazy, Suspense, useEffect, useState } from 'react';
import './styles.css';

// Each experiment lives in its own file and exports a default
// component. Lazy-loaded so the canvas/SVG/pretext variants don't
// bloat the initial bundle for the reader who's just scanning.

type ExpMeta = {
  num: number;
  title: string;
  blurb: string;
  loader: () => Promise<{ default: React.ComponentType }>;
};

const EXPERIMENTS: ExpMeta[] = [
  {
    num: 1,
    title: 'baseline',
    blurb:
      'Faithful clone of the essay setup. Sprite walks the column. Drag onto a mailbox. Standard pointer events.',
    loader: () => import('./experiments/01-baseline'),
  },
  {
    num: 2,
    title: 'padded hitbox',
    blurb:
      'Same as baseline, but a transparent 18 px halo extends the touch target on every side. Glyph stays small.',
    loader: () => import('./experiments/02-padded-hitbox'),
  },
  {
    num: 3,
    title: 'press-and-hold ring',
    blurb:
      'Sprite stops walking on press, draws a 350 ms charging ring, then becomes draggable. Spurious taps don’t grab.',
    loader: () => import('./experiments/03-press-hold'),
  },
  {
    num: 4,
    title: 'tap-arm, tap-deliver',
    blurb:
      'No drag at all. Tap a wandering sprite to arm it (it pauses + glows). Tap a mailbox to deliver. Two-step.',
    loader: () => import('./experiments/04-tap-arm'),
  },
  {
    num: 5,
    title: 'magnet pickup',
    blurb:
      'Touch the column anywhere within 80 px of a sprite and it slides to your finger. Forgiving on shaky hands.',
    loader: () => import('./experiments/05-magnet-pickup'),
  },
  {
    num: 6,
    title: 'magnetic mailbox',
    blurb:
      'While dragging, the sprite curves toward the nearest mailbox once you’re within 120 px. Aim is generous.',
    loader: () => import('./experiments/06-magnet-mailbox'),
  },
  {
    num: 7,
    title: 'mailbox calls a sprite',
    blurb:
      'Tap the mailbox. The nearest wandering sprite redirects, walks itself in, and delivers. Hands-free.',
    loader: () => import('./experiments/07-summon'),
  },
  {
    num: 8,
    title: 'pretext word-push',
    blurb:
      'Words laid out by @chenglou/pretext. The walking sprite physically displaces nearby words; spring snaps them back.',
    loader: () => import('./experiments/08-pretext-words'),
  },
  {
    num: 9,
    title: 'wake parting',
    blurb:
      'On the line a sprite is crossing, words split above and below to part around it. Cheap parlour trick.',
    loader: () => import('./experiments/09-wake-parting'),
  },
  {
    num: 10,
    title: 'magnetic letters',
    blurb:
      'Per-letter, not per-word. Each glyph leans toward a passing sprite by a few px. Calmer than the spring push.',
    loader: () => import('./experiments/10-magnet-letters'),
  },
  {
    num: 11,
    title: 'canvas sprite, DOM mailbox',
    blurb:
      'Sprite drawn to <canvas> for crisp 60 fps motion. Mailbox stays a DOM button. Hit-test via getBoundingClientRect.',
    loader: () => import('./experiments/11-canvas'),
  },
  {
    num: 12,
    title: 'svg foreignObject',
    blurb:
      'Whole stage in <svg>, prose in <foreignObject>, sprite as a vector group. One coordinate space, full transforms.',
    loader: () => import('./experiments/12-svg-foreign'),
  },
];

export default function App() {
  return (
    <div className="sbs-root">
      <header className="sbs-masthead">
        <div className="sbs-eyebrow">sandbox · sprite interactions</div>
        <h1 className="sbs-title">a dozen ways to grab the moogle</h1>
        <p className="sbs-lede">
          The essay <em>care for an esper</em> sends ASCII sprites walking
          across the column; the reader drags one onto a mailbox to open a
          letter. The interaction works on desktop. On mobile the hit target is
          tight. Below: twelve variants of the same gesture, each in its own
          card with its own spawn loop. Try each in turn. Pick which one feels
          right under a thumb.
        </p>
        <Toc />
      </header>
      <main className="sbs-main">
        {EXPERIMENTS.map((e) => (
          <LazyExperiment key={e.num} meta={e} />
        ))}
      </main>
      <footer className="sbs-foot">
        Spawn rate is intentionally faster than the essay so each card stays
        populated. Each stage is independent.
      </footer>
    </div>
  );
}

function Toc() {
  return (
    <nav className="sbs-toc" aria-label="experiments">
      <ol>
        {EXPERIMENTS.map((e) => (
          <li key={e.num}>
            <a href={`#exp-${e.num}`}>
              <span className="sbs-toc-num">№{String(e.num).padStart(2, '0')}</span>
              {e.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Defer mounting each experiment until it scrolls near the
// viewport. With twelve simultaneous spawn-and-rAF loops the page
// would otherwise burn battery for offscreen cards.

function LazyExperiment({ meta }: { meta: ExpMeta }) {
  const [mounted, setMounted] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref || mounted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(ref);
    return () => io.disconnect();
  }, [ref, mounted]);

  const Cmp = mounted
    ? lazy(meta.loader as () => Promise<{ default: React.ComponentType }>)
    : null;

  return (
    <div ref={setRef} id={`exp-${meta.num}`} className="sbs-card-shell">
      {Cmp ? (
        <Suspense
          fallback={
            <div className="sbs-card sbs-card-loading">loading…</div>
          }
        >
          <Cmp />
        </Suspense>
      ) : (
        <div className="sbs-card sbs-card-loading">
          <header className="sbs-card-head">
            <span className="sbs-card-num">
              №{String(meta.num).padStart(2, '0')}
            </span>
            <h2 className="sbs-card-title">{meta.title}</h2>
          </header>
          <p className="sbs-card-blurb">{meta.blurb}</p>
          <div className="sbs-stage sbs-stage-placeholder">
            scroll closer to load
          </div>
        </div>
      )}
    </div>
  );
}
