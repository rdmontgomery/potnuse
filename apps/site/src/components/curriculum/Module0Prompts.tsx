import { useMemo } from 'react';
import { freshModuleZeroCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

// Inline prompts for Module 0. Wraps the shared InlinePrompt with the
// Module 0 seeds and dispatches an m0-card-update window event after
// every verdict — the soft scroll gate listens for it to refresh its
// counter without a parent-child state lift.

function notifyGate(): void {
  try {
    window.dispatchEvent(new CustomEvent('m0-card-update'));
  } catch {
    /* CustomEvent unavailable in some old browsers — fine to skip */
  }
}

export default function Module0Prompts() {
  // Seeds are pure data; one set per mount keeps card ids stable across
  // re-renders without re-reading the store.
  const seeds = useMemo(() => freshModuleZeroCards(), []);
  return (
    <div className="m-prompts m0-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} onAfterSubmit={notifyGate} />
      ))}
    </div>
  );
}
