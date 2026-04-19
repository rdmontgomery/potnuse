export type DomainKey =
  | 'physics'
  | 'cybernetics'
  | 'philosophy'
  | 'literature'
  | 'social_theory'
  | 'music'
  | 'art'
  | 'ai_research';

export interface DomainConfig {
  color: string;
  label: string;
  gx: number;
  gy: number;
}

export const DOMAIN_CONFIG: Record<DomainKey, DomainConfig> = {
  physics:       { color: '#e8a838', label: 'Physics / Math',  gx: -250, gy: -180 },
  cybernetics:   { color: '#d98a3d', label: 'Cybernetics',     gx: -380, gy:   80 },
  philosophy:    { color: '#c48ac9', label: 'Philosophy',      gx:  120, gy: -220 },
  literature:    { color: '#7fb069', label: 'Literature',      gx:  250, gy:  180 },
  social_theory: { color: '#b77dbf', label: 'Social Theory',   gx:  -80, gy:  320 },
  music:         { color: '#e8a838', label: 'Music',           gx:  380, gy:  280 },
  art:           { color: '#e8544e', label: 'Art / Design',    gx:  380, gy:  -80 },
  ai_research:   { color: '#6b9ecb', label: 'AI / Tech',       gx: -320, gy: -280 },
};
