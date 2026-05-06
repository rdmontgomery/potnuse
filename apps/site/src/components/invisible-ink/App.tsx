import { useMemo, useRef, useState } from 'react';
import {
  countInvisibles,
  decode,
  embed,
  hasPayload,
  strip,
} from '@rdm/stego';

// The carrier and the payload it secretly carries on first load. Anyone who
// copies the inscription paragraph carries the second sentence with them.
const INSCRIPTION_VISIBLE = 'shave my head and read.';
const INSCRIPTION_HIDDEN = 'the body is the message.';

const COLORS = {
  bg: 'var(--bg)',
  card: 'var(--bg-card)',
  button: 'var(--bg-button)',
  border: 'var(--border)',
  text: 'var(--text)',
  dim: 'var(--text-dim)',
  muted: 'var(--text-muted)',
  accent: 'var(--accent)',
  accentDim: 'var(--accent-dim)',
};

const FONT_MONO = "var(--font-jetbrains), ui-monospace, monospace";

export default function InvisibleInk() {
  const inscription = useMemo(
    () => embed(INSCRIPTION_VISIBLE, INSCRIPTION_HIDDEN),
    [],
  );
  const [inscriptionDecode, setInscriptionDecode] = useState<string | null>(
    null,
  );

  const [decodeInput, setDecodeInput] = useState(inscription);
  const [decodeOutput, setDecodeOutput] = useState<
    { kind: 'ok'; value: string } | { kind: 'none' } | { kind: 'error' } | null
  >(null);

  const [payload, setPayload] = useState('the body is the message.');
  const [carrier, setCarrier] = useState('shave my head and read.');
  const stamped = useMemo(() => embed(carrier, payload), [carrier, payload]);

  const stamps = useMemo(
    () => ({
      invisibles: countInvisibles(decodeInput),
      framed: hasPayload(decodeInput),
    }),
    [decodeInput],
  );

  const stampedRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  function runDecode() {
    const result = decode(decodeInput);
    if (result === null) {
      if (hasPayload(decodeInput)) setDecodeOutput({ kind: 'error' });
      else setDecodeOutput({ kind: 'none' });
    } else {
      setDecodeOutput({ kind: 'ok', value: result });
    }
  }

  async function copyStamped() {
    try {
      await navigator.clipboard.writeText(stamped);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1200);
    } catch {
      stampedRef.current?.select();
    }
  }

  return (
    <section style={styles.root}>
      {/* Inscription panel */}
      <div style={styles.inscriptionWrap}>
        <p
          aria-label="inscription with hidden payload"
          style={styles.inscription}
        >
          {inscription}
        </p>
        <div style={styles.inscriptionRow}>
          <button
            type="button"
            style={styles.button}
            onClick={() => setInscriptionDecode(decode(inscription))}
          >
            decode the inscription
          </button>
          <span style={styles.stat}>
            {countInvisibles(inscription)} invisible characters
          </span>
        </div>
        {inscriptionDecode !== null && (
          <p style={styles.revealed}>
            <span style={styles.revealedLabel}>hidden:</span>{' '}
            <span style={styles.revealedText}>{inscriptionDecode || '(empty)'}</span>
          </p>
        )}
      </div>

      {/* Decode panel */}
      <div style={styles.panel}>
        <header style={styles.panelHead}>
          <h3 style={styles.h3}>decode</h3>
          <span style={styles.stat}>
            {stamps.invisibles} invisible · {stamps.framed ? 'frame detected' : 'no frame'}
          </span>
        </header>
        <textarea
          aria-label="text to decode"
          value={decodeInput}
          onChange={(e) => {
            setDecodeInput(e.target.value);
            setDecodeOutput(null);
          }}
          rows={5}
          style={styles.textarea}
          spellCheck={false}
        />
        <div style={styles.row}>
          <button type="button" style={styles.button} onClick={runDecode}>
            decode
          </button>
          <button
            type="button"
            style={styles.buttonGhost}
            onClick={() => {
              setDecodeInput(strip(decodeInput));
              setDecodeOutput(null);
            }}
          >
            strip invisibles
          </button>
          <button
            type="button"
            style={styles.buttonGhost}
            onClick={() => {
              setDecodeInput(inscription);
              setDecodeOutput(null);
            }}
          >
            use the inscription
          </button>
        </div>
        {decodeOutput && (
          <p style={styles.output}>
            {decodeOutput.kind === 'ok' && (
              <>
                <span style={styles.revealedLabel}>hidden:</span>{' '}
                <span style={styles.revealedText}>
                  {decodeOutput.value || '(empty)'}
                </span>
              </>
            )}
            {decodeOutput.kind === 'none' && (
              <span style={styles.muted}>nothing here.</span>
            )}
            {decodeOutput.kind === 'error' && (
              <span style={styles.muted}>
                a frame is present but the bits don't decode cleanly.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Encode panel */}
      <div style={styles.panel}>
        <header style={styles.panelHead}>
          <h3 style={styles.h3}>encode</h3>
          <span style={styles.stat}>
            {countInvisibles(stamped)} invisible characters out
          </span>
        </header>
        <label style={styles.label}>
          <span style={styles.labelText}>payload</span>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={2}
            style={styles.textarea}
            spellCheck={false}
          />
        </label>
        <label style={styles.label}>
          <span style={styles.labelText}>carrier</span>
          <textarea
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            rows={3}
            style={styles.textarea}
            spellCheck={false}
          />
        </label>
        <label style={styles.label}>
          <span style={styles.labelText}>stamped</span>
          <textarea
            ref={stampedRef}
            value={stamped}
            readOnly
            rows={3}
            style={{ ...styles.textarea, ...styles.textareaReadonly }}
            spellCheck={false}
          />
        </label>
        <div style={styles.row}>
          <button type="button" style={styles.button} onClick={copyStamped}>
            {copyState === 'copied' ? 'copied.' : 'copy stamped'}
          </button>
          <span style={styles.muted}>
            looks identical to the carrier. paste anywhere.
          </span>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2.2rem',
    margin: '2rem 0 3rem',
  },
  inscriptionWrap: {
    borderLeft: `2px solid ${COLORS.accentDim}`,
    paddingLeft: '1.2rem',
  },
  inscription: {
    fontFamily: 'var(--font-crimson)',
    fontSize: '1.35rem',
    lineHeight: 1.5,
    fontStyle: 'italic',
    color: COLORS.text,
    margin: '0 0 1rem',
  },
  inscriptionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  revealed: {
    margin: '1rem 0 0',
    fontFamily: FONT_MONO,
    fontSize: '0.85rem',
    color: COLORS.text,
  },
  revealedLabel: {
    color: COLORS.muted,
    textTransform: 'lowercase',
    letterSpacing: '0.12em',
    fontSize: '0.7rem',
  },
  revealedText: {
    color: COLORS.accent,
  },
  panel: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '1.2rem 1.3rem 1.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  panelHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  h3: {
    margin: 0,
    fontFamily: FONT_MONO,
    fontSize: '0.78rem',
    textTransform: 'lowercase',
    letterSpacing: '0.16em',
    color: COLORS.dim,
    fontWeight: 400,
  },
  stat: {
    fontFamily: FONT_MONO,
    fontSize: '0.7rem',
    color: COLORS.muted,
    letterSpacing: '0.04em',
  },
  textarea: {
    width: '100%',
    background: COLORS.bg,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 3,
    padding: '0.6rem 0.75rem',
    fontFamily: FONT_MONO,
    fontSize: '0.85rem',
    lineHeight: 1.55,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  textareaReadonly: {
    color: COLORS.dim,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    flexWrap: 'wrap',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  labelText: {
    fontFamily: FONT_MONO,
    fontSize: '0.7rem',
    color: COLORS.muted,
    textTransform: 'lowercase',
    letterSpacing: '0.12em',
  },
  button: {
    background: COLORS.accent,
    color: COLORS.bg,
    border: 'none',
    borderRadius: 3,
    padding: '0.55rem 1rem',
    fontFamily: FONT_MONO,
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    textTransform: 'lowercase',
    cursor: 'pointer',
  },
  buttonGhost: {
    background: COLORS.button,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 3,
    padding: '0.55rem 0.9rem',
    fontFamily: FONT_MONO,
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    textTransform: 'lowercase',
    cursor: 'pointer',
  },
  output: {
    margin: 0,
    padding: '0.6rem 0.8rem',
    borderTop: `1px solid ${COLORS.border}`,
    fontFamily: FONT_MONO,
    fontSize: '0.85rem',
  },
  muted: {
    color: COLORS.muted,
    fontFamily: FONT_MONO,
    fontSize: '0.75rem',
  },
};
