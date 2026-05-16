import { useState } from 'react';
import { rankKeys } from '@/lib/music/krumhansl';
import { PITCH_NAMES, type PitchClass } from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Operate for Module 9. Click pcs on the clock to weight them in a
// histogram; the inferred key flips in real time. The point is
// tactile: with a few well-chosen pcs the model converges fast on a
// key, and the listener watches the second- and third-place keys
// shuffle behind it.

const EMPTY_HISTOGRAM = (): number[] => new Array(12).fill(0);

export default function Module9Operate() {
  const [hist, setHist] = useState<number[]>(EMPTY_HISTOGRAM);

  const addPc = (pc: PitchClass) => {
    setHist((h) => {
      const next = [...h];
      next[pc] += 1;
      return next;
    });
  };

  const reset = () => setHist(EMPTY_HISTOGRAM());

  const totalWeight = hist.reduce((s, v) => s + v, 0);
  const ranking = totalWeight > 0 ? rankKeys(hist) : [];
  const top = ranking[0];
  const litPcs: PitchClass[] = hist
    .map((v, i) => (v > 0 ? (i as PitchClass) : -1))
    .filter((p): p is PitchClass => p >= 0);
  const max = Math.max(...hist, 1);

  return (
    <div className="m9-operate">
      <Z12Clock
        pcs={litPcs}
        onPcClick={addPc}
        labels="both"
        size={220}
        ariaLabel="click any pc to add weight to the histogram"
      />

      <div className="m9-bars m9-bars-small">
        {hist.map((v, i) => (
          <div key={i} className="m9-bar-col">
            <div
              className="m9-bar"
              style={{ height: `${(v / max) * 100}%`, opacity: v > 0 ? 1 : 0.2 }}
            />
            <span className="m9-bar-label">{i}</span>
          </div>
        ))}
      </div>

      {top && (
        <div className="m9-inferred">
          <span className="m9-inferred-label">best fit</span>
          <span className="m9-inferred-key">
            {PITCH_NAMES[top.tonic]} {top.mode}
          </span>
          <span className="m9-inferred-corr">r = {top.correlation.toFixed(3)}</span>
        </div>
      )}

      <div className="m9-operate-controls">
        <button type="button" className="m9-operate-btn" onClick={reset}>
          reset
        </button>
      </div>

      <p className="m9-operate-caption">
        Tap pcs on the clock to add weight; the model re-correlates
        against all 24 keys after each click and reports the best
        match. Try just <code>0, 4, 7</code> — the C major triad
        alone reads as C major. Add a few in-key non-chord tones and
        the correlation climbs.
      </p>
    </div>
  );
}
