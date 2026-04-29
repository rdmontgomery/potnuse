let _ctx: AudioContext | null = null;

export function getAudioCtx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/** Returns a stop() function. Tone sustains until stop() is called. */
export function startTone(freq: number, ctx: AudioContext): () => void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const mix = ctx.createGain();

  osc.type = 'sawtooth';
  osc2.type = 'square';
  osc.frequency.setValueAtTime(freq, now);
  osc2.frequency.setValueAtTime(freq * 1.002, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800 + Math.min(freq, 800), now);
  filter.Q.setValueAtTime(1.2, now);

  // Fast attack so even tap-and-release produces an audible note.
  // Jumping to 0.05 at t=0 guarantees we're never silent during the ramp.
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.linearRampToValueAtTime(0.13, now + 0.005);
  gain.gain.linearRampToValueAtTime(0.11, now + 0.08);
  mix.gain.setValueAtTime(0.06, now);

  osc.connect(filter);
  osc2.connect(mix);
  mix.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc2.start(now);

  return () => {
    const t = ctx.currentTime;
    // Floor at 0.05 so even sub-attack releases decay from an audible value
    const releaseFrom = Math.max(gain.gain.value, 0.05);
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(releaseFrom, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.06);
    osc.stop(t + 0.1);
    osc2.stop(t + 0.1);
  };
}

export function playTone(freq: number, duration: number, ctx: AudioContext): void {
  const stop = startTone(freq, ctx);
  setTimeout(stop, duration);
}
