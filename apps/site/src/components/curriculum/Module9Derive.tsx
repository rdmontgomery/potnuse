import { useMemo } from 'react';
import {
  buildHistogram,
  rankKeys,
  type KeyMatch,
} from '@/lib/music/krumhansl';
import { PITCH_NAMES, pitchClassOf } from '@/lib/music/pitchClass';
import { CHORALE_PHRASE } from '@/lib/music/chorale-phrase';

// Derive for Module 9. Compute the chorale phrase's pc histogram
// (weighted by note duration), correlate against all 24 keys, show
// the top three matches. With the chorale clearly in C, the top
// match should be C major — and Module 9's purpose is to show that
// the inference is *statistical*, not symbolic.

function keyLabel(m: KeyMatch): string {
  return `${PITCH_NAMES[m.tonic]} ${m.mode}`;
}

export default function Module9Derive() {
  // Build histogram from the chorale's lead voice (soprano) — that's
  // where the melodic identity lives. Weight by note duration in
  // sixteenth-note steps.
  const { histogram, ranking } = useMemo(() => {
    const events = CHORALE_PHRASE.notes
      .filter((n) => n.voice === 'lead')
      .map((n) => ({ pc: pitchClassOf(n.pitch), weight: n.dur }));
    const histogram = buildHistogram(events);
    const ranking = rankKeys(histogram);
    return { histogram, ranking };
  }, []);

  const max = Math.max(...histogram, 1);

  return (
    <div className="m9-derive">
      <div className="m9-derive-section">
        <span className="m9-derive-label">pc histogram of the chorale's soprano</span>
        <div className="m9-bars m9-bars-small">
          {histogram.map((v, i) => (
            <div key={i} className="m9-bar-col">
              <div
                className="m9-bar"
                style={{ height: `${(v / max) * 100}%` }}
              />
              <span className="m9-bar-label">{i}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="m9-derive-section">
        <span className="m9-derive-label">top-correlated keys</span>
        <ol className="m9-rank-list">
          {ranking.slice(0, 5).map((m, j) => (
            <li
              key={`${m.tonic}-${m.mode}`}
              className={j === 0 ? 'm9-rank top' : 'm9-rank'}
            >
              <span className="m9-rank-pos">{j + 1}</span>
              <span className="m9-rank-key">{keyLabel(m)}</span>
              <span className="m9-rank-corr">r = {m.correlation.toFixed(3)}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="m9-derive-caption">
        The top match is the maximum-likelihood key under the
        Krumhansl-Schmuckler model. For this phrase, C major wins
        decisively — but the model never had to be told what key it
        was in. It read it from the distribution alone.
      </p>
    </div>
  );
}
