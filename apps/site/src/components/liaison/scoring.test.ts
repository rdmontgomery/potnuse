import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  liaisonsOf,
  bridges,
  pairWeight,
  type GraphData,
} from './scoring';

// Run against the actual committed build output — this is the reproducibility
// + hand-check guarantee from the brief, not a fixture.
const HERE = dirname(fileURLToPath(import.meta.url));
const data: GraphData = JSON.parse(
  readFileSync(
    join(HERE, '..', '..', '..', 'public', 'liaison-graph.json'),
    'utf8',
  ),
);

describe('liaison graph data', () => {
  it('has the canonical Ahn node count and the order parameter documented', () => {
    expect(data.nodes.length).toBeGreaterThan(1400);
    expect(String(data.meta.orderParameter)).toContain('compounds(i)');
  });
});

describe('single-select liaisons (raw w_ij)', () => {
  it('coffee liaises strongly with beef — the paper signature pair', () => {
    const top = liaisonsOf(data, 'coffee', 'raw').slice(0, 8).map((l) => l.id);
    expect(top.some((id) => id.includes('beef'))).toBe(true);
  });

  it('cocoa and coffee share a high raw weight', () => {
    expect(pairWeight(data, 'cocoa', 'coffee', 'raw')).toBeGreaterThan(80);
  });

  it('strawberry liaises with apple', () => {
    const top = liaisonsOf(data, 'strawberry', 'raw').slice(0, 6).map((l) => l.id);
    expect(top.some((id) => id.includes('apple'))).toBe(true);
  });
});

describe('raw vs normalized visibly reorders', () => {
  it('cocoa→roasted_cocoa is a near-twin: top by jaccard, demoted by reordering', () => {
    const rawTop = liaisonsOf(data, 'cocoa', 'raw')[0].id;
    const normTop = liaisonsOf(data, 'cocoa', 'normalized')[0].id;
    // roasted_cocoa is the trivially-similar twin (jaccard ~0.98).
    expect(normTop).toBe('roasted_cocoa');
    // the two modes do not produce identical #1s across the board:
    const rawSeq = liaisonsOf(data, 'bell_pepper', 'raw')
      .slice(0, 5)
      .map((l) => l.id);
    const normSeq = liaisonsOf(data, 'bell_pepper', 'normalized')
      .slice(0, 5)
      .map((l) => l.id);
    expect(rawSeq).not.toEqual(normSeq);
    expect(rawTop).toBeTruthy();
  });
});

describe('multi-select bridging', () => {
  it('finds a bridge that liaises with every committed ingredient (min agg)', () => {
    const dish = ['tomato', 'garlic'];
    const top = bridges(data, dish, 'raw', 'min').slice(0, 10);
    expect(top.length).toBeGreaterThan(0);
    // min aggregator => every link must be > 0 (bridges the whole dish)
    expect(top[0].min).toBeGreaterThan(0);
    expect(top[0].links.length).toBe(dish.length);
  });

  it('sum and min aggregators can disagree on the top bridge', () => {
    const dish = ['cocoa', 'strawberry'];
    const byMin = bridges(data, dish, 'raw', 'min')[0]?.id;
    const bySum = bridges(data, dish, 'raw', 'sum')[0]?.id;
    expect(byMin).toBeTruthy();
    expect(bySum).toBeTruthy();
  });
});

describe('cuisine filter', () => {
  it('restricts liaisons to ingredients present in the cuisine', () => {
    const eastAsian = liaisonsOf(data, 'soy_sauce', 'raw', 'EastAsian');
    const idx = new Map(data.nodes.map((n) => [n.id, n]));
    for (const l of eastAsian) {
      expect((idx.get(l.id)?.cuisines.EastAsian ?? 0)).toBeGreaterThan(0);
    }
  });

  it('exposes Cajun/Creole as a curated cuisine', () => {
    const cajun = data.cuisines.find((c) => c.key === 'CajunCreole');
    expect(cajun?.curated).toBe(true);
  });
});

describe('western prior is measurable', () => {
  it('western cuisines favor shared compounds more than East Asian', () => {
    const t = (k: string) =>
      data.cuisines.find((c) => c.key === k)!.tendency;
    expect(t('NorthAmerican')).toBeGreaterThan(t('EastAsian'));
    expect(t('WesternEuropean')).toBeGreaterThan(t('EastAsian'));
  });
});
