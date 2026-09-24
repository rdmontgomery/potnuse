export type EdgeType =
  | 'influenced'
  | 'bridges'
  | 'tension'
  | 'co-domain'
  | 'collaborated'
  | 'applies'
  | 'extends';

export interface EdgeStyle {
  stroke: string;
  dash: string;
  width: number;
}

export const EDGE_STYLES: Record<EdgeType, EdgeStyle> = {
  influenced:    { stroke: 'var(--text-muted)', dash: 'none', width: 1 },
  bridges:       { stroke: 'light-dark(#946000, #e8a838)', dash: '6,3',  width: 1.5 },
  tension:       { stroke: 'light-dark(#b8322c, #e8544e)', dash: '3,3',  width: 1.5 },
  'co-domain':   { stroke: 'color-mix(in srgb, var(--text-muted) 55%, transparent)', dash: 'none', width: 0.8 },
  collaborated: { stroke: 'light-dark(#3f7a2a, #7fb069)', dash: 'none', width: 1.2 },
  applies:       { stroke: 'light-dark(#2c64a8, #6b9ecb)', dash: '4,2',  width: 1 },
  extends:       { stroke: 'light-dark(#a0521a, #d98a3d)', dash: 'none', width: 1 },
};
