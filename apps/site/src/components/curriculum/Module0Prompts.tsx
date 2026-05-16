import { useEffect, useMemo, useState } from 'react';
import {
  effectiveNow,
  getCard,
  upsertCard,
} from '@/lib/srs/store';
import { applyVerdict, dueAt } from '@/lib/srs/scheduler';
import { freshModuleZeroCards } from '@/lib/srs/seed';
import { instrumentFor } from '@/components/practice/InstrumentRegistry';
import type { Card, Verdict } from '@/lib/srs/schema';

// Inline prompts for Module 0. The instrument UI itself is shared with
// /practice via the InstrumentRegistry; this file just adds the
// persistence wrapper and the small "first encounter / due in Nd"
// status badge above each prompt.

function useCard(seed: Card): {
  card: Card;
  loading: boolean;
  submit: (verdict: Verdict) => Promise<void>;
} {
  const [card, setCard] = useState<Card>(seed);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCard(seed.id)
      .then((stored) => {
        if (!cancelled && stored) setCard(stored);
      })
      .catch((err) => console.error('load card', seed.id, err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seed.id]);

  const submit = async (verdict: Verdict) => {
    const now = effectiveNow();
    const next: Card = {
      ...card,
      scheduling: applyVerdict(card.scheduling, verdict, now),
      lastReviewedAt: now.getTime(),
      lastVerdict: verdict,
    };
    setCard(next);
    try {
      await upsertCard(next);
    } catch (err) {
      console.error('save card', seed.id, err);
    }
  };

  return { card, loading, submit };
}

function formatStatus(card: Card, now: Date): string {
  if (!card.lastReviewedAt) return 'first encounter';
  const due = dueAt(card.scheduling);
  const ms = due.getTime() - now.getTime();
  if (ms <= 0) return 'due now';
  const hours = ms / 3_600_000;
  if (hours < 1) return `due in ${Math.max(1, Math.round(ms / 60_000))}m`;
  if (hours < 24) return `due in ${Math.round(hours)}h`;
  return `due in ${Math.ceil(hours / 24)}d`;
}

function tagFor(card: Card): string {
  switch (card.prompt.kind) {
    case 'click-on-clock':
      return 'click on clock';
    case 'freeform-pc-in-key':
      return 'freeform';
  }
}

function InlinePrompt({ seed }: { seed: Card }) {
  const { card, loading, submit } = useCard(seed);
  const now = useMemo(() => effectiveNow(), []);
  const Instrument = instrumentFor(card);

  if (!Instrument) {
    return (
      <div className="prompt">no instrument for {card.prompt.kind}</div>
    );
  }

  return (
    <div className="prompt">
      <div className="prompt-q">
        <div className="prompt-tagrow">
          <span className="prompt-tag">{tagFor(card)}</span>
          <span className="prompt-status">
            {loading ? '…' : formatStatus(card, now)}
          </span>
        </div>
        <p>{card.prompt.question}</p>
        {card.prompt.kind === 'click-on-clock' && card.prompt.hint && (
          <p className="prompt-hint">{card.prompt.hint}</p>
        )}
      </div>
      <Instrument card={card} onVerdict={submit} />
    </div>
  );
}

export default function Module0Prompts() {
  // Seeds are pure data; one set per mount keeps card ids stable across
  // re-renders without re-reading the store.
  const seeds = useMemo(() => freshModuleZeroCards(), []);
  return (
    <div className="m0-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
