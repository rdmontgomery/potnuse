// Liaison scoring — the order parameter, made legible and testable.
//
//   liaison strength  w_ij = |compounds(i) ∩ compounds(j)|   (raw, shared count)
//   normalized        Jaccard = w_ij / (|Ci| + |Cj| − w_ij)
//
// Everything the UI ranks (single-select liaisons, multi-select bridges) routes
// through `weightOf` so there is exactly one place that decides what "strength"
// means under each toggle.

export type WeightMode = 'raw' | 'normalized';
export type BridgeAgg = 'min' | 'sum';

/** Compact adjacency entry: [neighborId, sharedCount (w_ij), jaccard]. */
export type Edge = [string, number, number];

export interface CuisineMeta {
  key: string;
  label: string;
  recipeCount: number | null;
  meanSharedPerPair: number;
  /** mean shared-compound count per co-occurring pair, minus network baseline. */
  tendency: number;
  curated: boolean;
}

export interface IngredientNode {
  id: string;
  name: string;
  category: string;
  /** number of aroma compounds — |compounds(i)|. */
  ncomp: number;
  /** cuisine key -> prevalence (fraction of that cuisine's recipes with this). */
  cuisines: Record<string, number>;
}

export interface GraphData {
  meta: Record<string, unknown> & { networkBaselineSharedPerPair: number };
  cuisines: CuisineMeta[];
  nodes: IngredientNode[];
  adj: Record<string, Edge[]>;
}

export interface Liaison {
  id: string;
  shared: number; // w_ij (raw order parameter)
  jaccard: number; // normalized
  weight: number; // whichever the active mode selects
}

/** The single chokepoint: map an edge to a strength under the active toggle. */
export function weightOf(edge: Edge, mode: WeightMode): number {
  return mode === 'raw' ? edge[1] : edge[2];
}

/** True when a node belongs to the active cuisine filter (null = no filter). */
export function inCuisine(
  node: IngredientNode | undefined,
  cuisine: string | null,
): boolean {
  if (!cuisine) return true;
  return !!node && (node.cuisines[cuisine] ?? 0) > 0;
}

/** Ranked liaisons of a single ingredient. */
export function liaisonsOf(
  data: GraphData,
  id: string,
  mode: WeightMode,
  cuisine: string | null = null,
): Liaison[] {
  const byId = nodeIndex(data);
  return (data.adj[id] ?? [])
    .filter(([nid]) => inCuisine(byId.get(nid), cuisine))
    .map(([nid, shared, jaccard]) => ({
      id: nid,
      shared,
      jaccard,
      weight: mode === 'raw' ? shared : jaccard,
    }))
    .sort((a, b) => b.weight - a.weight || b.shared - a.shared);
}

/** Liaison strength between two specific ingredients (0 beyond stored top-K). */
export function pairWeight(
  data: GraphData,
  a: string,
  b: string,
  mode: WeightMode,
): number {
  const fromA = data.adj[a]?.find((e) => e[0] === b);
  if (fromA) return weightOf(fromA, mode);
  const fromB = data.adj[b]?.find((e) => e[0] === a);
  if (fromB) return weightOf(fromB, mode);
  return 0;
}

export interface Bridge {
  id: string;
  /** weight to each committed ingredient, in committed order. */
  links: number[];
  min: number;
  sum: number;
  score: number; // the active aggregator's value
}

/**
 * Best bridging additions for a committed set (the "lock a dish, mutate one
 * axis" use case). A candidate is scored by its weight to every committed
 * ingredient; we rank by the chosen aggregator:
 *   - 'min': bridges the WHOLE dish (must liaise with all of it)
 *   - 'sum': total affinity (can lean hard on one member)
 */
export function bridges(
  data: GraphData,
  committed: string[],
  mode: WeightMode,
  agg: BridgeAgg = 'min',
  cuisine: string | null = null,
  limit = 20,
): Bridge[] {
  if (committed.length === 0) return [];
  const byId = nodeIndex(data);
  const committedSet = new Set(committed);

  // Candidate universe: anything adjacent to at least one committed ingredient.
  const candidates = new Set<string>();
  for (const c of committed) {
    for (const [nid] of data.adj[c] ?? []) {
      if (!committedSet.has(nid)) candidates.add(nid);
    }
  }

  const out: Bridge[] = [];
  for (const cand of candidates) {
    if (!inCuisine(byId.get(cand), cuisine)) continue;
    const links = committed.map((c) => pairWeight(data, cand, c, mode));
    const min = Math.min(...links);
    const sum = links.reduce((a, b) => a + b, 0);
    const score = agg === 'min' ? min : sum;
    out.push({ id: cand, links, min, sum, score });
  }
  return out
    .sort((a, b) => b.score - a.score || b.sum - a.sum)
    .slice(0, limit);
}

const INDEX = new WeakMap<GraphData, Map<string, IngredientNode>>();
export function nodeIndex(data: GraphData): Map<string, IngredientNode> {
  let idx = INDEX.get(data);
  if (!idx) {
    idx = new Map(data.nodes.map((n) => [n.id, n]));
    INDEX.set(data, idx);
  }
  return idx;
}
