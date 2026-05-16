import { useMemo, useState } from 'react';
import Z12Clock from '@/components/curriculum/Z12Clock';
import { matchesPcInC, pcName } from '@/lib/music/pitchClass';
import type { PitchClass } from '@/lib/music/pitchClass';
import type { Card, Verdict } from '@/lib/srs/schema';

// Shared instrument components. Each accepts a card + onVerdict callback and
// renders the input UI for one prompt kind. They don't persist anything
// themselves — the caller (Module 0's inline prompt or /practice's runner)
// decides what to do with the verdict.

export interface InstrumentProps {
  card: Card;
  onVerdict: (verdict: Verdict) => void;
}

export function ClickOnClockInstrument({
  card,
  onVerdict,
}: InstrumentProps) {
  if (card.prompt.kind !== 'click-on-clock') {
    throw new Error('ClickOnClockInstrument needs a click-on-clock card');
  }
  const [selected, setSelected] = useState<Set<PitchClass>>(new Set());
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const expected = useMemo(
    () => new Set(card.prompt.kind === 'click-on-clock' ? card.prompt.expectedPcs : []),
    [card.prompt],
  );

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
    onVerdict(v);
  };

  const unsure = () => {
    setVerdict('unsure');
    onVerdict('unsure');
  };

  const clear = () => {
    setSelected(new Set());
    setVerdict(null);
  };

  return (
    <div className="instrument click-on-clock-instrument">
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
          `Got it. Every pc shifted by +3 in lockstep — transposition as group action.`}
        {verdict === 'wrong' &&
          `Not quite. Expected ${[...expected]
            .sort((a, b) => a - b)
            .join(', ')}.`}
        {verdict === 'unsure' &&
          `Noted. This card will come back around sooner.`}
      </VerdictNote>
    </div>
  );
}

export function FreeformPcInstrument({ card, onVerdict }: InstrumentProps) {
  if (card.prompt.kind !== 'freeform-pc-in-key') {
    throw new Error('FreeformPcInstrument needs a freeform-pc-in-key card');
  }
  const expectedPc =
    card.prompt.kind === 'freeform-pc-in-key' ? card.prompt.expectedPc : 0;
  const placeholder =
    card.prompt.kind === 'freeform-pc-in-key'
      ? (card.prompt.placeholder ?? '')
      : '';
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const check = () => {
    const v: Verdict = matchesPcInC(input, expectedPc) ? 'correct' : 'wrong';
    setVerdict(v);
    onVerdict(v);
  };

  const unsure = () => {
    setVerdict('unsure');
    onVerdict('unsure');
  };

  return (
    <div className="instrument freeform-instrument">
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
    </div>
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
