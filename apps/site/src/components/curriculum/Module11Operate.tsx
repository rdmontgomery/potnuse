import { useMemo, useRef, useState } from 'react';
import {
  choraleHistogram,
  makeRng,
  orderStrength,
  thermalize,
} from '@/lib/music/activeMatter';
import { PITCH_NAMES } from '@/lib/music/pitchClass';

// Operate for Module 11. Manual temperature dial. Pull T toward zero
// and the chorale's pc distribution + best key correlation snap into
// place. Push T up and watch the inferred key wander and the order
// parameter shrink. The histogram updates live alongside.

const T_MAX = 5.0;

export default function Module11Operate() {
  const [t, setT] = useState(0);
  // Re-seed each interaction so the noisy distribution is dynamic
  // without flickering on every render.
  const rngRef = useRef(makeRng(7));
  const cold = useMemo(() => choraleHistogram(), []);
  const noisy = useMemo(
    () => thermalize(cold, t, rngRef.current),
    [cold, t],
  );
  const { best, runnerUp, margin } = orderStrength(noisy);
  const max = Math.max(...noisy, 1);

  const reseed = () => {
    rngRef.current = makeRng(Date.now() & 0xffffffff);
    setT((cur) => cur); // trigger re-memo without changing T
  };

  return (
    <div className="m11-operate">
      <div className="m11-slider-row">
        <span className="m11-slider-label">temperature</span>
        <input
          type="range"
          min={0}
          max={T_MAX}
          step={0.05}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="m11-slider"
          aria-label="temperature"
        />
        <span className="m11-slider-value">{t.toFixed(2)}</span>
      </div>

      <div className="m9-bars m9-bars-small m11-hist">
        {noisy.map((v, i) => (
          <div key={i} className="m9-bar-col">
            <div
              className="m9-bar"
              style={{ height: `${(v / max) * 100}%` }}
            />
            <span className="m9-bar-label">{i}</span>
          </div>
        ))}
      </div>

      <div className="m11-inference">
        <div className="m11-inf-row">
          <span className="m11-inf-pos">1</span>
          <span className="m11-inf-key m11-inf-top">
            {PITCH_NAMES[best.tonic]} {best.mode}
          </span>
          <span className="m11-inf-corr">r = {best.correlation.toFixed(3)}</span>
        </div>
        <div className="m11-inf-row dim">
          <span className="m11-inf-pos">2</span>
          <span className="m11-inf-key">
            {PITCH_NAMES[runnerUp.tonic]} {runnerUp.mode}
          </span>
          <span className="m11-inf-corr">r = {runnerUp.correlation.toFixed(3)}</span>
        </div>
        <div className="m11-margin">
          margin {margin.toFixed(3)}
        </div>
      </div>

      <div className="m11-operate-controls">
        <button type="button" className="m11-operate-btn" onClick={reseed}>
          re-noise
        </button>
        <button
          type="button"
          className="m11-operate-btn"
          onClick={() => setT(0)}
        >
          quench (T → 0)
        </button>
      </div>

      <p className="m11-operate-caption">
        At <strong>T = 0</strong> the chorale's tonality is locked: C
        major wins with a wide margin. Drag the slider up and the
        margin collapses — second-place keys start trading the lead.
        Hit <em>re-noise</em> to roll a fresh sample at the same
        temperature; the inference is stable in expectation but
        fluctuates per draw.
      </p>
    </div>
  );
}
