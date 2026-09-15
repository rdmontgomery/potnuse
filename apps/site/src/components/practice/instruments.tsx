import { useEffect, useMemo, useRef, useState } from 'react';
import Z12Clock from '@/components/curriculum/Z12Clock';
import {
  PITCH_NAMES,
  matchesPcInC,
  mod12,
  pcName,
} from '@/lib/music/pitchClass';
import type { PitchClass } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';
import { takeOver } from '@/lib/music/audioBus';
import type { Card, Verdict } from '@/lib/srs/schema';

function midiToTonePitch(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

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

export function MultipleChoiceInstrument({
  card,
  onVerdict,
}: InstrumentProps) {
  if (card.prompt.kind !== 'multiple-choice') {
    throw new Error('MultipleChoiceInstrument needs a multiple-choice card');
  }
  const { choices, correctIndex, explanation } = card.prompt;
  const [picked, setPicked] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const pick = (i: number) => {
    if (verdict === 'correct') return;
    setPicked(i);
    const v: Verdict = i === correctIndex ? 'correct' : 'wrong';
    setVerdict(v);
    onVerdict(v);
  };

  const unsure = () => {
    setVerdict('unsure');
    onVerdict('unsure');
  };

  return (
    <div className="instrument multiple-choice-instrument">
      <div className="mc-choices" role="radiogroup">
        {choices.map((choice, i) => {
          const selected = picked === i;
          const showCorrect = verdict && i === correctIndex;
          const showWrong = verdict === 'wrong' && selected;
          return (
            <button
              key={i}
              type="button"
              className={[
                'mc-choice',
                selected ? 'selected' : '',
                showCorrect ? 'correct' : '',
                showWrong ? 'wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => pick(i)}
              role="radio"
              aria-checked={selected}
              disabled={verdict === 'correct'}
            >
              {choice}
            </button>
          );
        })}
      </div>
      <div className="prompt-actions">
        <button
          type="button"
          className="unsure"
          onClick={unsure}
          disabled={verdict === 'correct'}
        >
          unsure
        </button>
      </div>
      <VerdictNote verdict={verdict}>
        {verdict === 'correct' &&
          (explanation ?? `Yes — ${choices[correctIndex]}.`)}
        {verdict === 'wrong' && `Not quite. The right one is "${choices[correctIndex]}".`}
        {verdict === 'unsure' &&
          `Noted. The right one is "${choices[correctIndex]}" — card comes back sooner.`}
      </VerdictNote>
    </div>
  );
}

export function IdentifyByEarInstrument({
  card,
  onVerdict,
}: InstrumentProps) {
  if (card.prompt.kind !== 'identify-by-ear') {
    throw new Error('IdentifyByEarInstrument needs an identify-by-ear card');
  }
  const { audio, choices, correctIndex, explanation } = card.prompt;
  const [picked, setPicked] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const timersRef = useRef<number[]>([]);
  const busHandleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, []);

  const play = async () => {
    if (playing) return;
    setPlaying(true);
    setHasPlayed(true);
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
    busHandleRef.current = takeOver(
      () => {
        for (const t of timersRef.current) window.clearTimeout(t);
        timersRef.current = [];
      },
      () => setPlaying(false),
    );

    let piano;
    try {
      piano = await getPiano();
    } catch (err) {
      console.error('identify-by-ear load failed', err);
      setPlaying(false);
      return;
    }

    const noteDur = audio.noteDuration ?? 0.4;
    const sustain = audio.sustain ?? noteDur + 0.1;

    if (audio.kind === 'chord') {
      const pitches = audio.midi.map(midiToTonePitch);
      piano.triggerAttackRelease(pitches, sustain, undefined, 0.75);
      const t = window.setTimeout(() => {
        busHandleRef.current?.();
        busHandleRef.current = null;
        setPlaying(false);
      }, sustain * 1000 + 100);
      timersRef.current.push(t);
    } else {
      for (let i = 0; i < audio.midi.length; i++) {
        const t = window.setTimeout(() => {
          piano!.triggerAttackRelease(
            midiToTonePitch(audio.midi[i]),
            sustain,
            undefined,
            0.75,
          );
        }, i * noteDur * 1000);
        timersRef.current.push(t);
      }
      const finalT = window.setTimeout(
        () => {
          busHandleRef.current?.();
          busHandleRef.current = null;
          setPlaying(false);
        },
        audio.midi.length * noteDur * 1000 + sustain * 1000,
      );
      timersRef.current.push(finalT);
    }
  };

  const pick = (i: number) => {
    if (verdict === 'correct') return;
    if (!hasPlayed) return;
    setPicked(i);
    const v: Verdict = i === correctIndex ? 'correct' : 'wrong';
    setVerdict(v);
    onVerdict(v);
  };

  const unsure = () => {
    setVerdict('unsure');
    onVerdict('unsure');
  };

  return (
    <div className="instrument identify-by-ear-instrument">
      <div className="ear-controls">
        <button
          type="button"
          className={`ear-play ${playing ? 'on' : ''}`}
          onClick={() => void play()}
          disabled={playing}
        >
          {playing ? 'listening…' : hasPlayed ? 'play again' : 'play'}
        </button>
      </div>
      <div
        className="mc-choices"
        role="radiogroup"
        aria-disabled={!hasPlayed}
      >
        {choices.map((choice, i) => {
          const selected = picked === i;
          const showCorrect = verdict && i === correctIndex;
          const showWrong = verdict === 'wrong' && selected;
          return (
            <button
              key={i}
              type="button"
              className={[
                'mc-choice',
                selected ? 'selected' : '',
                showCorrect ? 'correct' : '',
                showWrong ? 'wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => pick(i)}
              role="radio"
              aria-checked={selected}
              disabled={verdict === 'correct' || !hasPlayed}
            >
              {choice}
            </button>
          );
        })}
      </div>
      <div className="prompt-actions">
        <button
          type="button"
          className="unsure"
          onClick={unsure}
          disabled={verdict === 'correct'}
        >
          unsure
        </button>
      </div>
      <VerdictNote verdict={verdict}>
        {verdict === 'correct' &&
          (explanation ?? `Yes — ${choices[correctIndex]}.`)}
        {verdict === 'wrong' &&
          `Not quite. The right one is "${choices[correctIndex]}". Hit play again and listen for it.`}
        {verdict === 'unsure' &&
          `Noted. The right one is "${choices[correctIndex]}" — card comes back sooner.`}
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
