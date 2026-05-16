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

  // Drag-rotate fires per 30° step. Each step is a semitone of transposition;
  // the chord moves rigidly because that's what transposeSet does on the
  // pitch-class set.
  const rotate = (step: number) =>
    setPcs((prev) => transposeSet(prev, step).sort((a, b) => a - b));

  const reflect = () => {
    setAxisFlash(true);
    setPcs((prev) => invertSet(prev, INVERSION_AXIS).sort((a, b) => a - b));
    window.setTimeout(() => setAxisFlash(false), 1400);
  };

  const reset = () => setPcs([...C_MAJOR_TRIAD]);

  return (
    <div className="m0-derive">
      <Z12Clock
        pcs={pcs}
        onPcClick={togglePc}
        onRotateStep={rotate}
        showChord
        showAxis={axisFlash}
        axisPc={INVERSION_AXIS}
        labels="both"
        size={260}
        ariaLabel="interactive pitch-class clock — click to toggle, drag to rotate"
      />
      <p className="m0-derive-hint">
        click any dot to toggle · drag the wheel to rotate · reflect to invert
      </p>
      <div className="m0-derive-row">
        <span className="m0-derive-pcs">
          {pcs.length === 0
            ? '(no pitch classes selected)'
            : pcs.map((p) => `${p}·${pcName(p)}`).join('  ')}
        </span>
      </div>
      <div className="m0-derive-controls">
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
