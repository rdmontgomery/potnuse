import { useState } from 'react';
import {
  FUNDAMENTALS,
  PARTIALS,
  midiToHz,
  partialFreq,
  type Fundamental,
} from '@/lib/music/overtones';
import { getSineSynth } from '@/lib/music/audio';
import {
  PITCH_NAMES,
  mod12,
  type PitchClass,
} from '@/lib/music/pitchClass';
import Z12Clock from './Z12Clock';

// Derive for Module 1. The fundamental moves; the triad at partials 4-5-6
// rotates rigidly with it. That's the entire pedagogical point — the
// major triad is a fact of the spectrum, not a stipulation of theory.
//
// The clock shows the three triad pcs and connects them with a polygon so
// the chord shape is visible as a triangle. "Hear the triad" plays the
// three partials together as sines.

export default function Module1Derive() {
  const [fund, setFund] = useState<Fundamental>(FUNDAMENTALS[0]);
  const [playing, setPlaying] = useState(false);

  const triadPcs: PitchClass[] = [
    fund.pc,
    mod12(fund.pc + 4),
    mod12(fund.pc + 7),
  ];

  const playTriad = async () => {
    if (playing) return;
    setPlaying(true);
    try {
      const synth = await getSineSynth();
      const freqs = [4, 5, 6].map((n) =>
        partialFreq(midiToHz(fund.midi), PARTIALS[n - 1]),
      );
      synth.triggerAttackRelease(freqs, 1.4);
    } catch (err) {
      console.error('m1 derive triad failed', err);
    } finally {
      window.setTimeout(() => setPlaying(false), 1500);
    }
  };

  return (
    <div className="m1-derive">
      <div className="m1-fund-row">
        <span className="m1-fund-label">fundamental</span>
        <div className="m1-fund-buttons">
          {FUNDAMENTALS.map((f) => (
            <button
              key={f.midi}
              type="button"
              className={
                f.midi === fund.midi ? 'm1-fund-btn active' : 'm1-fund-btn'
              }
              onClick={() => setFund(f)}
              aria-pressed={f.midi === fund.midi}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Z12Clock
        pcs={triadPcs}
        showChord
        size={220}
        labels="both"
        ariaLabel={`triad pitch classes of ${fund.label}: ${triadPcs.map((p) => PITCH_NAMES[p]).join(', ')}`}
      />

      <p className="m1-derive-caption">
        Partials 4, 5, 6 of {fund.label} land on{' '}
        <strong>{triadPcs.map((p) => PITCH_NAMES[p]).join(' – ')}</strong> —
        a {PITCH_NAMES[fund.pc]} major triad. Move the fundamental, the
        triangle rotates; the chord quality doesn't.
      </p>

      <button
        type="button"
        className="m1-derive-play"
        onClick={() => void playTriad()}
        disabled={playing}
      >
        {playing ? 'ringing…' : 'hear the triad'}
      </button>
    </div>
  );
}
