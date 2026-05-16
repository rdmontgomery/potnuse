import { useState } from 'react';
import {
  PARTIALS,
  TRIAD_PARTIALS,
  midiToHz,
  midiToNoteLabel,
  partialFreq,
  partialMidi,
} from '@/lib/music/overtones';
import { getSineSynth } from '@/lib/music/audio';

// Behold for Module 1. The first eight partials of C2, stacked with the
// fundamental at the bottom. The triad living in partials 4-5-6 is lit
// amber so the major chord appears as a fact of nature, not a definition.
// Each row is a button — tap to hear the sine wave at that partial.
//
// No autoplay; the page is silent until the user taps. That matches the
// browser's autoplay rules and the Module 0 / Behold pattern.

const FUNDAMENTAL_MIDI = 36; // C2
const FUNDAMENTAL_HZ = midiToHz(FUNDAMENTAL_MIDI);

export default function Module1Behold() {
  const [active, setActive] = useState<number | null>(null);

  const playPartial = async (n: number) => {
    setActive(n);
    try {
      const synth = await getSineSynth();
      const partial = PARTIALS[n - 1];
      const freq = partialFreq(FUNDAMENTAL_HZ, partial);
      synth.triggerAttackRelease(freq, 0.7);
    } catch (err) {
      console.error('m1 behold play failed', err);
    } finally {
      window.setTimeout(() => {
        setActive((cur) => (cur === n ? null : cur));
      }, 700);
    }
  };

  return (
    <div className="m1-behold" aria-label="overtone series of C2, partials 1 through 8">
      {/* Render the partials high-to-low so the eye reads fundamental at the
          bottom — matches a frequency axis with low at the floor. */}
      {[...PARTIALS].reverse().map((p) => {
        const midi = partialMidi(FUNDAMENTAL_MIDI, p);
        const label = midiToNoteLabel(midi);
        const inTriad = TRIAD_PARTIALS.has(p.n);
        const isActive = active === p.n;
        return (
          <button
            key={p.n}
            type="button"
            className={[
              'm1-partial',
              inTriad ? 'triad' : '',
              isActive ? 'active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => void playPartial(p.n)}
            aria-label={`partial ${p.n}, ${label}${p.tempered ? ', approximately' : ''}, ratio ${p.ratio} to 1`}
          >
            <span className="m1-partial-n">{p.n}</span>
            <span className="m1-partial-note">
              {label}
              {p.tempered ? <sup>*</sup> : null}
            </span>
            <span className="m1-partial-ratio">{p.ratio}:1</span>
          </button>
        );
      })}
      <p className="m1-behold-foot">
        <strong>4, 5, 6</strong> stack into a major triad — built into the
        spectrum of one note. <sup>*</sup>partial 7 is ~31 cents flatter
        than equal-tempered B♭.
      </p>
    </div>
  );
}
