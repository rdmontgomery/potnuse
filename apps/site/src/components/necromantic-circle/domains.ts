export type DomainKey =
  | 'physics'
  | 'cybernetics'
  | 'philosophy'
  | 'literature'
  | 'social_theory'
  | 'music'
  | 'art'
  | 'ai_research';

// light-dark() picks by the active theme's color-scheme: the dark values
// are the originals, the light ones deepened to read on paper.
export interface DomainConfig {
  color: string;
  label: string;
  gx: number;
  gy: number;
}

export const DOMAIN_CONFIG: Record<DomainKey, DomainConfig> = {
  physics:       { color: 'light-dark(#946000, #e8a838)', label: 'Physics / Math',  gx: -250, gy: -180 },
  cybernetics:   { color: 'light-dark(#a0521a, #d98a3d)', label: 'Cybernetics',     gx: -380, gy:   80 },
  philosophy:    { color: 'light-dark(#86448e, #c48ac9)', label: 'Philosophy',      gx:  120, gy: -220 },
  literature:    { color: 'light-dark(#3f7a2a, #7fb069)', label: 'Literature',      gx:  250, gy:  180 },
  social_theory: { color: 'light-dark(#a0357a, #b77dbf)', label: 'Social Theory',   gx:  -80, gy:  320 },
  music:         { color: 'light-dark(#946000, #e8a838)', label: 'Music',           gx:  380, gy:  280 },
  art:           { color: 'light-dark(#b8322c, #e8544e)', label: 'Art / Design',    gx:  380, gy:  -80 },
  ai_research:   { color: 'light-dark(#2c64a8, #6b9ecb)', label: 'AI / Tech',       gx: -320, gy: -280 },
};
