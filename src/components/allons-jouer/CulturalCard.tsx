import { useState } from 'react';
import { K, FONTS } from '@/lib/allons-jouer/tokens';
import type { CulturalCard as CulturalCardType } from '@/lib/allons-jouer/types';

interface Props {
  card: CulturalCardType;
  autoExpand?: boolean;
}

export function CulturalCard({ card, autoExpand = false }: Props) {
  const [expanded, setExpanded] = useState(autoExpand);

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${K.border}`, marginBottom: 16 }}>
      <button onClick={() => setExpanded(e => !e)} style={{
        width: '100%', padding: '12px 16px', background: K.bgCard, border: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer', fontFamily: FONTS.serif,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: K.accent }}>About this song</span>
        <span style={{ fontSize: 12, color: K.textMuted }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', background: K.bgCard }}>
          <p style={{ fontSize: 14, color: K.textDim, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 16px 0', fontFamily: FONTS.serif }}>
            {card.context}
          </p>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: K.bgButton, marginBottom: 12, fontFamily: FONTS.mono, fontSize: 14, color: K.text, letterSpacing: 2 }}>
            {card.tab}
          </div>
          <a href={card.recordingUrl} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 6,
            background: K.accent + '22', border: `1px solid ${K.accent}44`,
            color: K.accent, fontSize: 13, textDecoration: 'none', fontFamily: FONTS.serif,
          }}>
            🎵 {card.recordingLabel}
          </a>
        </div>
      )}
    </div>
  );
}
