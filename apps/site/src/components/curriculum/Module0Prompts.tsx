import { useEffect, useMemo, useState } from 'react';
import { matchesPcInC, pcName } from '@/lib/music/pitchClass';
import type { PitchClass } from '@/lib/music/pitchClass';
import {
  freshModuleZeroCards,
  MODULE_0_SOPRANO_PCS,
} from '@/lib/srs/seed';
import {
  effectiveNow,
  getCard,
  upsertCard,
} from '@/lib/srs/store';
import { applyVerdict, dueAt } from '@/lib/srs/scheduler';
import type { Card, Verdict } from '@/lib/srs/schema';
import Z12Clock from './Z12Clock';

// Hook that hydrates a card from IndexedDB, falling back to the seed until
// the load completes. submit() applies a verdict via the FSRS scheduler and
// persists the new state. Errors are logged, not surfaced — losing a save
// on a freeform card is annoying but not catastrophic.
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
    const nextScheduling = applyVerdict(card.scheduling, verdict, now);
    const next: Card = {
      ...card,
      scheduling: nextScheduling,
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
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `due in ${Math.max(1, Math.round(ms / 60000))}m`;
  if (hours < 24) return `due in ${Math.round(hours)}h`;
  const days = Math.ceil(hours / 24);
  return `due in ${days}d`;
}

function PromptShell({
  card,
  loading,
  children,
  now,
}: {
  card: Card;
  loading: boolean;
  children: React.ReactNode;
  now: Date;
}) {
  const status = loading ? '…' : formatStatus(card, now);
  return (
    <div className="prompt">
      <div className="prompt-q">
        <div className="prompt-tagrow">
          <span className="prompt-tag">{card.prompt.kind === 'click-on-clock' ? 'click on clock' : 'freeform'}</span>
          <span className="prompt-status">{status}</span>
        </div>
        <p>{card.prompt.question}</p>
        {card.prompt.kind === 'click-on-clock' && card.prompt.hint && (
          <p className="prompt-hint">
            {card.prompt.hint.replace(/`([^`]+)`/g, '$1')}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function ClickOnClockPrompt({ seed }: { seed: Card }) {
  if (seed.prompt.kind !== 'click-on-clock') {
    throw new Error('expected click-on-clock prompt');
  }
  const { card, loading, submit } = useCard(seed);
  const [selected, setSelected] = useState<Set<PitchClass>>(new Set());
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const now = useMemo(() => effectiveNow(), []);

  const expected = useMemo(() => {
    if (card.prompt.kind !== 'click-on-clock') return new Set<PitchClass>();
    return new Set(card.prompt.expectedPcs);
  }, [card.prompt]);

  const toggle = (pc: PitchClass) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pc)) next.delete(pc);
      else next.add(pc);
      return next;
    });
    setVerdict(null);
  };

  const check = () => {
    const same =
      selected.size === expected.size &&
      [...expected].every((pc) => selected.has(pc));
    const v: Verdict = same ? 'correct' : 'wrong';
    setVerdict(v);
    void submit(v);
  };

  const unsure = () => {
    setVerdict('unsure');
    void submit('unsure');
  };

  const clear = () => {
    setSelected(new Set());
    setVerdict(null);
  };

  return (
    <PromptShell card={card} loading={loading} now={now}>
      <Z12Clock
        pcs={[...selected]}
        onPcClick={toggle}
        showChord
        labels="numbers"
        size={220}
        ariaLabel="answer clock"
      />
      <div className="prompt-actions">
        <button type="button" className="check" onClick={check}>
          check
        </button>
        <button type="button" className="unsure" onClick={unsure}>
          unsure
        </button>
        <button type="button" className="ghost" onClick={clear}>
          clear
        </button>
      </div>
      <VerdictNote verdict={verdict}>
        {verdict === 'correct' &&
          `Got it. The phrase's pcs all shifted by +3 in lockstep — that's transposition as group action.`}
        {verdict === 'wrong' &&
          `Not quite. Expected ${[...expected].sort((a, b) => a - b).join(', ')}.`}
        {verdict === 'unsure' &&
          `Noted. This card will come back around sooner.`}
      </VerdictNote>
    </PromptShell>
  );
}

function FreeformPrompt({ seed }: { seed: Card }) {
  if (seed.prompt.kind !== 'freeform-pc-in-key') {
    throw new Error('expected freeform-pc-in-key prompt');
  }
  const { card, loading, submit } = useCard(seed);
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const now = useMemo(() => effectiveNow(), []);

  const expectedPc =
    card.prompt.kind === 'freeform-pc-in-key' ? card.prompt.expectedPc : 0;

  const check = () => {
    const ok = matchesPcInC(input, expectedPc);
    const v: Verdict = ok ? 'correct' : 'wrong';
    setVerdict(v);
    void submit(v);
  };

  const unsure = () => {
    setVerdict('unsure');
    void submit('unsure');
  };

  const placeholder =
    card.prompt.kind === 'freeform-pc-in-key'
      ? (card.prompt.placeholder ?? '')
      : '';

  return (
    <PromptShell card={card} loading={loading} now={now}>
      <div className="prompt-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setVerdict(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="check" onClick={check}>
          check
        </button>
        <button type="button" className="unsure" onClick={unsure}>
          unsure
        </button>
      </div>
      <VerdictNote verdict={verdict}>
        {verdict === 'correct' && `Yes — ${pcName(expectedPc)} (fa).`}
        {verdict === 'wrong' &&
          `Try again — pitch class ${expectedPc} is the fourth scale degree of C major.`}
        {verdict === 'unsure' &&
          `Noted. This card will come back around sooner.`}
      </VerdictNote>
    </PromptShell>
  );
}

function VerdictNote({
  verdict,
  children,
}: {
  verdict: Verdict | null;
  children: React.ReactNode;
}) {
  if (!verdict) return null;
  return <p className={`prompt-r ${verdict}`}>{children}</p>;
}

export default function Module0Prompts() {
  // Seed once per mount so the IDs are stable across re-renders.
  const seeds = useMemo(() => freshModuleZeroCards(), []);
  return (
    <div className="m0-prompts">
      <ClickOnClockPrompt seed={seeds[0]} />
      <FreeformPrompt seed={seeds[1]} />
    </div>
  );
}

// Re-exported so tests / future modules can crib the hint without recomputing.
export { MODULE_0_SOPRANO_PCS };
