import { useState } from 'react';
import {
  invertSet,
  pcName,
  transposeSet,
  type PitchClass,
} from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// C major triad as the opening offering — gives the user a chord to act on
// instead of staring at an empty wheel.
const C_MAJOR_TRIAD: readonly PitchClass[] = [0, 4, 7];
const INVERSION_AXIS: PitchClass = 0;

export default function Module0Derive() {
  const [pcs, setPcs] = useState<PitchClass[]>([...C_MAJOR_TRIAD]);
  const [axisFlash, setAxisFlash] = useState(false);

  const togglePc = (pc: PitchClass) => {
    setPcs((prev) =>
      prev.includes(pc)
        ? prev.filter((x) => x !== pc)
        : [...prev, pc].sort((a, b) => a - b),
    );
  };

  const transposeBy = (n: number) => setPcs((prev) => transposeSet(prev, n));

  const reflect = () => {
    setAxisFlash(true);
    setPcs((prev) => invertSet(prev, INVERSION_AXIS));
    window.setTimeout(() => setAxisFlash(false), 1400);
  };

  const reset = () => setPcs([...C_MAJOR_TRIAD]);

  return (
    <div className="m0-derive">
      <Z12Clock
        pcs={pcs}
        onPcClick={togglePc}
        showChord
        showAxis={axisFlash}
        axisPc={INVERSION_AXIS}
        labels="both"
        size={260}
        ariaLabel="clickable pitch-class clock"
      />
      <div className="m0-derive-row">
        <span className="m0-derive-pcs">
          {pcs.length === 0
            ? 'click any pitch class on the clock'
            : pcs
                .map((p) => `${p}·${pcName(p)}`)
                .join('  ')}
        </span>
      </div>
      <div className="m0-derive-controls">
        <button
          type="button"
          onClick={() => transposeBy(-1)}
          aria-label="transpose down one semitone"
        >
          −1
        </button>
        <button
          type="button"
          onClick={() => transposeBy(1)}
          aria-label="transpose up one semitone"
        >
          +1
        </button>
        <button type="button" onClick={reflect}>
          reflect
        </button>
        <button type="button" className="ghost" onClick={reset}>
          reset
        </button>
      </div>
    </div>
  );
}
