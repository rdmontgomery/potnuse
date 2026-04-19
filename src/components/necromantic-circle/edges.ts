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
  influenced:    { stroke: '#9e8e72', dash: 'none', width: 1 },
  bridges:       { stroke: '#e8a838', dash: '6,3',  width: 1.5 },
  tension:       { stroke: '#e8544e', dash: '3,3',  width: 1.5 },
  'co-domain':   { stroke: '#6b5d48', dash: 'none', width: 0.8 },
  collaborated: { stroke: '#7fb069', dash: 'none', width: 1.2 },
  applies:       { stroke: '#6b9ecb', dash: '4,2',  width: 1 },
  extends:       { stroke: '#d98a3d', dash: 'none', width: 1 },
};
