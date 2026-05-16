import { useEffect, useState } from 'react';
import {
  effectiveNow,
  getAllCards,
  getDueCards,
  upsertCard,
} from '@/lib/srs/store';
import { applyVerdict, dueAt } from '@/lib/srs/scheduler';
import { freshModuleZeroCards } from '@/lib/srs/seed';
import { instrumentFor } from './InstrumentRegistry';
import type { Card, Verdict } from '@/lib/srs/schema';

type Phase = 'loading' | 'empty' | 'running' | 'done';

// Drill surface. Pulls cards whose scheduling.due has elapsed, sorted by due
// time, and iterates them one at a time. Each card mounts its instrument via
// the registry — no naked text cards, Victor's mandate. Submitting a verdict
// advances both the FSRS state in storage and the runner's index.

export default function PracticeRunner() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [queue, setQueue] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Seed Module 0's cards if the store is fresh — keeps /practice
        // useful even for a user who hasn't visited /curriculum yet.
        const existing = await getAllCards();
        const have = new Set(existing.map((c) => c.id));
        for (const seed of freshModuleZeroCards()) {
          if (!have.has(seed.id)) {
            await upsertCard(seed);
          }
        }
        const due = await getDueCards(effectiveNow());
        if (cancelled) return;
        setQueue(due);
        setPhase(due.length === 0 ? 'empty' : 'running');
      } catch (err) {
        console.error('practice load failed', err);
        if (!cancelled) setPhase('empty');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onVerdict = async (verdict: Verdict) => {
    const current = queue[index];
    if (!current) return;
    const now = effectiveNow();
    const next: Card = {
      ...current,
      scheduling: applyVerdict(current.scheduling, verdict, now),
      lastReviewedAt: now.getTime(),
      lastVerdict: verdict,
    };
    try {
      await upsertCard(next);
    } catch (err) {
      console.error('practice save failed', err);
    }
    // Brief delay so the user sees the verdict note before advancing.
    window.setTimeout(() => {
      setIndex((i) => i + 1);
      if (index + 1 >= queue.length) setPhase('done');
    }, 900);
  };

  if (phase === 'loading') {
    return <p className="practice-status">loading queue…</p>;
  }

  if (phase === 'empty') {
    return <Empty />;
  }

  if (phase === 'done' || index >= queue.length) {
    return <Done count={queue.length} />;
  }

  const current = queue[index];
  const Instrument = instrumentFor(current);
  if (!Instrument) {
    return (
      <p className="practice-status">
        no instrument registered for {current.prompt.kind}
      </p>
    );
  }

  return (
    <div className="practice-card">
      <header className="practice-card-head">
        <span className="practice-progress">
          {index + 1} of {queue.length}
        </span>
        <span className="practice-tag">module {current.moduleId} · {current.concept}</span>
      </header>
      <p className="practice-question">{current.prompt.question}</p>
      {current.prompt.kind === 'click-on-clock' && current.prompt.hint && (
        <p className="practice-hint">{current.prompt.hint}</p>
      )}
      <Instrument
        card={current}
        onVerdict={onVerdict}
        key={current.id /* reset instrument state per card */}
      />
    </div>
  );
}

function Empty() {
  return (
    <div className="practice-empty">
      <p>No cards are due.</p>
      <p>
        Stop by <a href="/curriculum">/curriculum</a> to scroll through the
        modules — every prompt you answer joins the queue here.
      </p>
      <p className="practice-empty-tip">
        Or simulate a return visit:{' '}
        <a href="/practice?demo-srs">/practice?demo-srs</a> shifts the clock
        forward 24 hours so already-answered cards come due.
      </p>
    </div>
  );
}

function Done({ count }: { count: number }) {
  return (
    <div className="practice-done">
      <p>
        Done — {count} card{count === 1 ? '' : 's'} reviewed. The next batch
        will surface when its scheduling catches up.
      </p>
      <p>
        Back to <a href="/curriculum">/curriculum</a>.
      </p>
    </div>
  );
}

// Helper used by the empty / banner views elsewhere — exported in case other
// surfaces want to display "next due" copy without rendering the runner.
export function describeNextDue(cards: Card[], now: Date): string | null {
  if (cards.length === 0) return null;
  const upcoming = cards
    .map((c) => dueAt(c.scheduling).getTime() - now.getTime())
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return 'now';
  const ms = upcoming[0];
  const hours = ms / 3600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.ceil(hours / 24)}d`;
}
