import { useEffect, useRef, useState, useCallback } from 'react';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import { getAudioCtx } from '@/lib/allons-jouer/audio';
import { autoCorrelate, freqToAccordionNote } from '@/lib/allons-jouer/pitchUtils';
import { ACCORDION_NOTES } from '@/lib/allons-jouer/accordion';
import type { DetectedNote } from '@/lib/allons-jouer/types';

interface DiagData {
  rms: number;
  rawFreq: number;
  matched: DetectedNote | null;
  sampleRate: number;
  bufferSize: number;
}

export function TunerScreen() {
  const goHome = useAppStore(s => s.goHome);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiagData | null>(null);
  const [history, setHistory] = useState<DiagData[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    bufferRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const ctx = getAudioCtx();
      ctxRef.current = ctx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize);

      setError(null);
      setListening(true);

      const detect = () => {
        if (!analyserRef.current || !bufferRef.current || !ctxRef.current) return;
        analyserRef.current.getFloatTimeDomainData(bufferRef.current);

        // Compute RMS
        let rms = 0;
        for (let i = 0; i < bufferRef.current.length; i++) {
          rms += bufferRef.current[i] * bufferRef.current[i];
        }
        rms = Math.sqrt(rms / bufferRef.current.length);

        const rawFreq = autoCorrelate(bufferRef.current, ctxRef.current.sampleRate);
        const matched = rawFreq > 0 ? freqToAccordionNote(rawFreq) : null;

        const data: DiagData = {
          rms,
          rawFreq,
          matched,
          sampleRate: ctxRef.current.sampleRate,
          bufferSize: bufferRef.current.length,
        };

        setDiag(data);
        if (rawFreq > 0) {
          setHistory(prev => [data, ...prev].slice(0, 20));
        }

        rafRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch {
      setError('Mic access needed. Check browser permissions.');
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  // Peak volume (0-1) for the big meter, updated from diag.rms
  const peak = diag ? Math.min(diag.rms / 0.12, 1) : 0;
  const peakDb = diag && diag.rms > 0 ? 20 * Math.log10(diag.rms) : -Infinity;

  const rmsBar = diag ? Math.min(diag.rms / 0.15, 1) : 0;
  const rmsColor = diag && diag.rms < 0.01 ? K.pull : K.push;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={goHome} style={{ background: 'none', border: 'none', color: K.textDim, cursor: 'pointer', fontSize: 14, fontFamily: FONTS.serif }}>
          ← Back
        </button>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px 0', color: K.accent, fontFamily: FONTS.serif }}>
        Tuner / Diagnostics
      </h2>
      <p style={{ fontSize: 13, color: K.textDim, margin: '0 0 20px 0', fontFamily: FONTS.serif }}>
        Shows raw pitch detection data. Play a note to see what the app detects.
      </p>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, background: K.pull + '22', border: `1px solid ${K.pull}44`, color: K.pullBright, fontSize: 13 }}>
          {error}
        </div>
      )}

      <button onClick={listening ? stop : start} style={{
        width: '100%', padding: '14px 24px', marginBottom: 20,
        background: listening ? K.pull + '22' : K.accent + '22',
        border: `1px solid ${listening ? K.pull + '44' : K.accent + '44'}`,
        borderRadius: 10, cursor: 'pointer',
        color: listening ? K.pullBright : K.accent,
        fontSize: 16, fontWeight: 600, fontFamily: FONTS.serif,
      }}>
        {listening ? 'Stop Listening' : 'Start Listening'}
      </button>

      {/* Volume meter — always visible when listening */}
      {listening && (
        <div style={{ marginBottom: 20, padding: 16, background: K.bgCard, borderRadius: 10, border: `1px solid ${K.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: K.text, fontFamily: FONTS.serif }}>
              Volume
            </span>
            <span style={{ fontSize: 12, fontFamily: FONTS.mono, color: peak > 0.01 ? K.text : K.textMuted }}>
              {peakDb === -Infinity ? '-∞' : `${peakDb.toFixed(1)}`} dB
            </span>
          </div>
          {/* Big segmented meter */}
          <div style={{ display: 'flex', gap: 2, height: 32, alignItems: 'flex-end' }}>
            {Array.from({ length: 30 }, (_, i) => {
              const threshold = (i + 1) / 30;
              const lit = peak >= threshold;
              let color: string;
              if (i < 18) color = K.push;
              else if (i < 24) color = K.accent;
              else color = K.pull;
              return (
                <div key={i} style={{
                  flex: 1, height: '100%', borderRadius: 2,
                  background: lit ? color : K.bgButton,
                  opacity: lit ? 1 : 0.3,
                  transition: 'background 0.04s, opacity 0.04s',
                }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: K.textMuted, fontFamily: FONTS.mono }}>silence</span>
            <span style={{ fontSize: 10, color: peak < 0.01 ? K.pull : K.textMuted, fontFamily: FONTS.serif }}>
              {peak < 0.003 ? 'No audio detected — is the mic working?' : peak < 0.01 ? 'Very quiet — below detection threshold' : 'Signal OK'}
            </span>
            <span style={{ fontSize: 10, color: K.textMuted, fontFamily: FONTS.mono }}>loud</span>
          </div>
        </div>
      )}

      {/* Live readings */}
      {diag && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {/* RMS meter */}
          <div style={{ padding: 14, background: K.bgCard, borderRadius: 10, border: `1px solid ${K.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: FONTS.serif }}>
                RMS Level
              </span>
              <span style={{ fontSize: 13, fontFamily: FONTS.mono, color: rmsColor }}>
                {diag.rms.toFixed(4)}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: K.bgButton, overflow: 'hidden' }}>
              <div style={{
                width: `${rmsBar * 100}%`, height: '100%', borderRadius: 4,
                background: rmsColor, transition: 'width 0.05s',
              }} />
            </div>
            {diag.rms < 0.01 && (
              <div style={{ fontSize: 11, color: K.pull, marginTop: 4, fontFamily: FONTS.serif }}>
                Below threshold (0.01) — autoCorrelate will return -1
              </div>
            )}
          </div>

          {/* Raw frequency */}
          <div style={{ padding: 14, background: K.bgCard, borderRadius: 10, border: `1px solid ${K.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: FONTS.serif }}>
                Raw Frequency
              </span>
              <span style={{ fontSize: 20, fontFamily: FONTS.mono, fontWeight: 700, color: diag.rawFreq > 0 ? K.text : K.textMuted }}>
                {diag.rawFreq > 0 ? `${diag.rawFreq.toFixed(1)} Hz` : 'No pitch'}
              </span>
            </div>
            {diag.rawFreq > 0 && (diag.rawFreq < 200 || diag.rawFreq > 2200) && (
              <div style={{ fontSize: 11, color: K.pull, marginTop: 4, fontFamily: FONTS.serif }}>
                Outside matching range (200-2200 Hz) — freqToAccordionNote will return null
              </div>
            )}
          </div>

          {/* Matched note */}
          <div style={{ padding: 14, background: K.bgCard, borderRadius: 10, border: `1px solid ${K.border}` }}>
            <div style={{ fontSize: 11, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: FONTS.serif }}>
              Matched Note
            </div>
            {diag.matched ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{
                  fontSize: 32, fontWeight: 700, fontFamily: FONTS.mono,
                  color: diag.matched.dir === 'push' ? K.pushBright : K.pullBright,
                }}>
                  {diag.matched.note}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: K.textDim, fontFamily: FONTS.serif }}>
                    Button {diag.matched.button} / {diag.matched.dir}
                  </div>
                  <div style={{ fontSize: 13, color: K.textDim, fontFamily: FONTS.serif }}>
                    Expected: {diag.matched.freq.toFixed(1)} Hz
                  </div>
                  <div style={{
                    fontSize: 13, fontFamily: FONTS.mono,
                    color: diag.matched.dist < 0.5 ? K.success : diag.matched.dist < 1.0 ? K.accent : K.pullBright,
                  }}>
                    Distance: {diag.matched.dist.toFixed(2)} semitones
                    {diag.matched.dist >= 1.5 && ' (would be rejected)'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 15, color: K.textMuted, fontFamily: FONTS.serif }}>
                {diag.rawFreq > 0 ? 'No match within 1.5 semitones' : 'Waiting for pitch...'}
              </div>
            )}
          </div>

          {/* Audio context info */}
          <div style={{ padding: 14, background: K.bgCard, borderRadius: 10, border: `1px solid ${K.border}` }}>
            <div style={{ fontSize: 11, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: FONTS.serif }}>
              Audio Context
            </div>
            <div style={{ fontSize: 12, color: K.textDim, fontFamily: FONTS.mono }}>
              Sample rate: {diag.sampleRate} Hz / Buffer: {diag.bufferSize} samples / Min detectable: ~{(diag.sampleRate / diag.bufferSize * 2).toFixed(0)} Hz
            </div>
          </div>
        </div>
      )}

      {/* Recent detections */}
      {history.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: FONTS.serif }}>
            Recent Detections
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 10px', borderRadius: 6,
                background: i === 0 ? K.bgCard : 'transparent',
                fontSize: 12, fontFamily: FONTS.mono, color: K.textDim,
              }}>
                <span style={{ minWidth: 50, color: h.rawFreq > 0 ? K.text : K.textMuted }}>
                  {h.rawFreq > 0 ? `${h.rawFreq.toFixed(1)}` : '—'}
                </span>
                <span style={{
                  minWidth: 36, fontWeight: 700,
                  color: h.matched ? (h.matched.dir === 'push' ? K.pushBright : K.pullBright) : K.textMuted,
                }}>
                  {h.matched?.note ?? '—'}
                </span>
                <span style={{ minWidth: 60 }}>
                  {h.matched ? `btn ${h.matched.button} ${h.matched.dir}` : ''}
                </span>
                <span style={{
                  color: h.matched ? (h.matched.dist < 0.5 ? K.success : h.matched.dist < 1.0 ? K.accent : K.pullBright) : K.textMuted,
                }}>
                  {h.matched ? `${h.matched.dist.toFixed(2)}st` : ''}
                </span>
                <span style={{ color: K.textMuted }}>
                  rms {h.rms.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accordion reference */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 13, color: K.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: FONTS.serif }}>
          Expected Frequencies
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ACCORDION_NOTES.map(btn => (
            <div key={btn.button} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 10px', fontSize: 12, fontFamily: FONTS.mono, color: K.textDim,
            }}>
              <span style={{ minWidth: 20, color: K.textMuted }}>{btn.button}</span>
              <span style={{ minWidth: 60, color: K.push }}>
                {btn.push.note} {btn.push.freq.toFixed(1)}
              </span>
              <span style={{ minWidth: 60, color: K.pull }}>
                {btn.pull.note} {btn.pull.freq.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
