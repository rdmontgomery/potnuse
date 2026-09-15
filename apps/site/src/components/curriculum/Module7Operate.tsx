import { useEffect, useRef, useState } from 'react';
import {
  apply,
  triadMidi,
  triadName,
  triadPcs,
  type PLR,
  type Triad,
} from '@/lib/music/neoRiemannian';
import { PITCH_NAMES, mod12 } from '@/lib/music/pitchClass';
import { getPiano } from '@/lib/music/audio';
import { takeOver } from '@/lib/music/audioBus';
import Z12Clock from './Z12Clock';

// Operate for Module 7. PLR lab. Start on C major; tap P, L, or R to
// transform the current triad and hear the result. The chain history
// shows every step so the listener can trace how few moves it takes
// to reach surprising places — three Ps + Ls give the hexatonic
// cycle; chains of R alternating with L circle through the modal
// neighborhoods.

const SEED: Triad = { root: 0, quality: 'major' };
const CHORD_S = 1.0;

function midiToTonePitch(midi: number): string {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}

interface ChainEntry {
  triad: Triad;
  op: PLR | null;
}

export default function Module7Operate() {
  const [chain, setChain] = useState<ChainEntry[]>([
    { triad: SEED, op: null },
  ]);
  const [busy, setBusy] = useState(false);
  const busHandleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      busHandleRef.current?.();
      busHandleRef.current = null;
    };
  }, []);

  const current = chain[chain.length - 1].triad;

  const transform = async (op: PLR) => {
    if (busy) return;
    const next = apply(current, op);
    setChain((c) => [...c, { triad: next, op }]);
    setBusy(true);
    busHandleRef.current = takeOver(
      () => {
        /* no in-flight timers — chord finishes naturally */
      },
      () => setBusy(false),
    );
    try {
      const piano = await getPiano();
      const midis = triadMidi(next);
      const pitches = midis.map(midiToTonePitch);
      piano.triggerAttackRelease(pitches, CHORD_S, undefined, 0.78);
    } catch (err) {
      console.error('m7 operate play failed', err);
    }
    window.setTimeout(() => {
      busHandleRef.current?.();
      busHandleRef.current = null;
      setBusy(false);
    }, CHORD_S * 1000 + 60);
  };

  const reset = () => {
    busHandleRef.current?.();
    busHandleRef.current = null;
    setChain([{ triad: SEED, op: null }]);
    setBusy(false);
  };

  const currentPcs = [...triadPcs(current)].sort((a, b) => a - b);
  const polygon = [...currentPcs, currentPcs[0]];

  return (
    <div className="m7-operate">
      <Z12Clock
        pcs={currentPcs}
        polygonPath={polygon}
        tonicPc={current.root}
        labels="both"
        size={220}
        ariaLabel={`${triadName(current)} — current triad`}
      />

      <div className="m7-op-row">
        {(['P', 'L', 'R'] as PLR[]).map((op) => (
          <button
            key={op}
            type="button"
            className="m7-op-btn"
            onClick={() => void transform(op)}
            disabled={busy}
          >
            {op}
          </button>
        ))}
        <button
          type="button"
          className="m7-op-btn m7-op-reset"
          onClick={reset}
          disabled={chain.length <= 1}
        >
          reset
        </button>
      </div>

      <div className="m7-chain">
        {chain.map((step, j) => (
          <span key={j} className="m7-chain-step">
            {step.op && <span className="m7-chain-op">→{step.op}→</span>}
            <span
              className={
                j === chain.length - 1
                  ? 'm7-chain-name current'
                  : 'm7-chain-name'
              }
            >
              {triadName(step.triad)}
            </span>
          </span>
        ))}
      </div>

      <p className="m7-operate-caption">
        Three involutions; twenty-four triads to visit. Try{' '}
        <code>P L P L P L</code> and notice you've returned home in six
        steps — that's the <em>hexatonic cycle</em>, one of the most
        striking patterns the PLR group generates.
      </p>
    </div>
  );
}
