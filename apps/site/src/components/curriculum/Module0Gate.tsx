import { useEffect, useState } from 'react';
import { freshModuleZeroCards } from '@/lib/srs/seed';
import { getCard } from '@/lib/srs/store';

// Soft scroll gate between Module 0 and the rest of the spine. Watches the
// store for Module 0's two cards and renders a checkpoint card with the
// current progress. While Module 0 is incomplete, document.body picks up a
// class that dims the placeholder modules below — a hint, not a hard lock,
// since the doc's "required to scroll past" is a pedagogical force rather
// than a UX one.
//
// Module0Prompts dispatches an 'm0-card-update' window event on every
// verdict submit; we listen and re-read the store so the chip updates as
// the user answers without blocking the prompt's own optimistic render.

const GATE_CLASS = 'm0-gate-active';

type State =
  | { kind: 'loading' }
  | { kind: 'pending'; answered: number; total: number }
  | { kind: 'complete'; total: number };

export default function Module0Gate() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const seeds = freshModuleZeroCards();
    const total = seeds.length;

    async function refresh() {
      try {
        const stored = await Promise.all(
          seeds.map((s) => getCard(s.id)),
        );
        if (cancelled) return;
        const answered = stored.filter((c) => c?.lastVerdict).length;
        setState(
          answered >= total
            ? { kind: 'complete', total }
            : { kind: 'pending', answered, total },
        );
      } catch (err) {
        console.error('gate refresh failed', err);
      }
    }

    void refresh();
    const handler = () => void refresh();
    window.addEventListener('m0-card-update', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('m0-card-update', handler);
    };
  }, []);

  const isPending = state.kind === 'pending';

  useEffect(() => {
    const cls = document.body.classList;
    if (isPending) cls.add(GATE_CLASS);
    else cls.remove(GATE_CLASS);
    return () => cls.remove(GATE_CLASS);
  }, [isPending]);

  if (state.kind === 'loading') {
    return <div className="m0-checkpoint loading" aria-hidden />;
  }

  if (state.kind === 'complete') {
    return (
      <div className="m0-checkpoint complete" role="status">
        <span className="m0-checkpoint-mark" aria-hidden>
          ✓
        </span>
        <p>
          <strong>module 0 complete.</strong> the spiral continues — keep
          scrolling. (returning here later, prompts come back around on
          their own schedule.)
        </p>
      </div>
    );
  }

  return (
    <div className="m0-checkpoint pending" role="status" aria-live="polite">
      <span className="m0-checkpoint-counter">
        {state.answered}/{state.total}
      </span>
      <p>
        <strong>finish the prompts</strong> before moving on. "unsure"
        counts — the card just comes back sooner.
      </p>
    </div>
  );
}
