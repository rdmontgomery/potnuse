import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import {
  PARTIALS,
  TRIAD_PARTIALS,
  midiToHz,
} from '@/lib/music/overtones';
import { takeOver } from '@/lib/music/audioBus';

// Operate for Module 1. Additive-synthesis sandbox. Each of the eight
// partials gets a toggle and its own sine oscillator + gain; the
// fundamental's frequency is fixed at C2 so the listener can focus on
// timbre rather than pitch. Toggling a partial while the drone is
// running ramps its gain to (or from) zero in 50ms — slow enough to
// avoid clicks, fast enough to feel responsive.
//
// Default state: only the fundamental is on. The user adds partials and
// hears the timbre shift from pure sine toward sawtooth.

const FUNDAMENTAL_MIDI = 36;
const FUNDAMENTAL_HZ = midiToHz(FUNDAMENTAL_MIDI);

// 1/n decay scaled so the sum across all eight partials stays under one
// — keeps the output below clipping when every partial is on at once.
function gainTarget(index: number, on: boolean): number {
  return on ? 0.22 / (index + 1) : 0;
}

export default function Module1Operate() {
  const [actives, setActives] = useState<boolean[]>(() => {
    const arr = new Array(PARTIALS.length).fill(false);
    arr[0] = true;
    return arr;
  });
  const [playing, setPlaying] = useState(false);
  const nodesRef = useRef<
    { osc: Tone.Oscillator; gain: Tone.Gain }[] | null
  >(null);
  // Deregister handle for the audioBus — held while this module owns
  // the bus, called on natural stop or when something else takes over.
  const busHandleRef = useRef<(() => void) | null>(null);

  // Always tear down on unmount; otherwise a navigation-away leaves
  // eight oscillators humming.
  useEffect(() => {
    return () => {
      disposeNodes();
      busHandleRef.current?.();
      busHandleRef.current = null;
    };
  }, []);

  function disposeNodes() {
    if (!nodesRef.current) return;
    for (const { osc, gain } of nodesRef.current) {
      try {
        osc.stop();
      } catch {
        /* not started or already stopped */
      }
      osc.dispose();
      gain.dispose();
    }
    nodesRef.current = null;
  }

  const togglePartial = (i: number) => {
    setActives((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      const node = nodesRef.current?.[i];
      if (node) node.gain.gain.rampTo(gainTarget(i, next[i]), 0.05);
      return next;
    });
  };

  const start = async () => {
    if (playing) return;
    try {
      await Tone.start();
    } catch (err) {
      console.error('m1 operate audio start failed', err);
      return;
    }
    disposeNodes();
    nodesRef.current = PARTIALS.map((p, i) => {
      const gain = new Tone.Gain(gainTarget(i, actives[i])).toDestination();
      const osc = new Tone.Oscillator({
        type: 'sine',
        frequency: FUNDAMENTAL_HZ * p.ratio,
      });
      osc.connect(gain);
      osc.start();
      return { osc, gain };
    });
    busHandleRef.current = takeOver(
      () => disposeNodes(),
      () => setPlaying(false),
    );
    setPlaying(true);
  };

  const stop = () => {
    busHandleRef.current?.();
    busHandleRef.current = null;
    disposeNodes();
    setPlaying(false);
  };

  return (
    <div className="m1-operate">
      <div className="m1-toggle-row">
        {PARTIALS.map((p, i) => {
          const on = actives[i];
          const inTriad = TRIAD_PARTIALS.has(p.n);
          return (
            <button
              key={p.n}
              type="button"
              className={[
                'm1-toggle',
                on ? 'on' : 'off',
                inTriad ? 'triad' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => togglePartial(i)}
              aria-pressed={on}
              aria-label={`partial ${p.n}, ${on ? 'on' : 'off'}`}
            >
              <span className="m1-toggle-n">{p.n}</span>
              <span className="m1-toggle-dot" aria-hidden>
                {on ? '●' : '○'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="m1-operate-controls">
        <button
          type="button"
          className={`m1-operate-play ${playing ? 'on' : 'off'}`}
          onClick={() => (playing ? stop() : void start())}
        >
          {playing ? 'stop' : 'start drone'}
        </button>
      </div>

      <p className="m1-operate-caption">
        Fundamental alone is a pure sine. Add the octave (2), the fifth
        (3), more octaves and a third (4-5-6) — the same fundamental
        starts sounding like a different instrument. Timbre is harmonic
        recipe.
      </p>
    </div>
  );
}
