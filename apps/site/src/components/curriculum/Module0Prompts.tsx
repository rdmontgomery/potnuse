import { useMemo, useState } from 'react';
import {
  matchesPcInC,
  pcName,
  pitchClassOf,
  transposeSet,
  type PitchClass,
} from '@/lib/music/pitchClass';
import { BWV269 } from '@/lib/music/bwv269';
import Z12Clock from './Z12Clock';

type Verdict = 'pending' | 'correct' | 'wrong' | 'unsure';

const M3 = 3;

// Distinct pcs in the soprano line of the chorale phrase, sorted. These are
// what the user is asked to transpose by a minor third.
const SOPRANO_PCS: PitchClass[] = (() => {
  const set = new Set<PitchClass>();
  for (const n of BWV269.notes) {
    if (n.voice === 'lead') set.add(pitchClassOf(n.pitch));
  }
  return [...set].sort((a, b) => a - b);
})();

const TARGET_PCS: Set<PitchClass> = new Set(transposeSet(SOPRANO_PCS, M3));

function PromptClickOnClock() {
  const [selected, setSelected] = useState<Set<PitchClass>>(new Set());
  const [verdict, setVerdict] = useState<Verdict>('pending');

  const toggle = (pc: PitchClass) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pc)) next.delete(pc);
      else next.add(pc);
      return next;
    });
    setVerdict('pending');
  };

  const check = () => {
    const same =
      selected.size === TARGET_PCS.size &&
      [...TARGET_PCS].every((pc) => selected.has(pc));
    setVerdict(same ? 'correct' : 'wrong');
  };

  const clear = () => {
    setSelected(new Set());
    setVerdict('pending');
  };

  return (
    <div className="prompt">
      <div className="prompt-q">
        <span className="prompt-tag">click on clock</span>
        <p>
          Transpose the chorale phrase up a minor third. Click each new pitch
          class on the clock.
        </p>
        <p className="prompt-hint">
          The phrase uses pcs{' '}
          <code>{SOPRANO_PCS.join(', ')}</code>. Add three to each, mod 12.
        </p>
      </div>
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
        <button
          type="button"
          className="unsure"
          onClick={() => setVerdict('unsure')}
        >
          unsure
        </button>
        <button type="button" className="ghost" onClick={clear}>
          clear
        </button>
      </div>
      <VerdictNote verdict={verdict}>
        {verdict === 'correct' &&
          `Got it. The phrase's six pcs all shifted by +3 in lockstep — that's transposition as group action.`}
        {verdict === 'wrong' &&
          `Not quite. ${
            [...selected].length === 0
              ? 'Try clicking the pcs three places clockwise from the originals.'
              : `Expected ${[...TARGET_PCS].sort((a, b) => a - b).join(', ')}.`
          }`}
        {verdict === 'unsure' &&
          `Noted. This card will come back around sooner.`}
      </VerdictNote>
    </div>
  );
}

function PromptFreeform() {
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('pending');

  const check = () => {
    setVerdict(matchesPcInC(input, 5) ? 'correct' : 'wrong');
  };

  return (
    <div className="prompt">
      <div className="prompt-q">
        <span className="prompt-tag">freeform</span>
        <p>
          Pitch class 5 in the key of C major is also known as
          <span className="prompt-blank"> ___</span>
        </p>
      </div>
      <div className="prompt-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setVerdict('pending');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
          placeholder="a note name, or a solfege syllable"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="check" onClick={check}>
          check
        </button>
        <button
          type="button"
          className="unsure"
          onClick={() => setVerdict('unsure')}
        >
          unsure
        </button>
      </div>
      <VerdictNote verdict={verdict}>
        {verdict === 'correct' && `Yes — ${pcName(5)} (fa).`}
        {verdict === 'wrong' &&
          `Try again — pitch class 5 is the fourth scale degree of C major.`}
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
  verdict: Verdict;
  children: React.ReactNode;
}) {
  if (verdict === 'pending') return null;
  return <p className={`prompt-r ${verdict}`}>{children}</p>;
}

export default function Module0Prompts() {
  // Memoize once so re-renders don't reshuffle the prompt order.
  const prompts = useMemo(
    () => [<PromptClickOnClock key="clock" />, <PromptFreeform key="text" />],
    [],
  );
  return <div className="m0-prompts">{prompts}</div>;
}
