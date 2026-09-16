import type { Node } from './graph';
import { temporalU } from './temporal';

export const SIGIL_COLORS: Record<string, string> = {
  essays: '#e8a838',
  experiments: '#7fb069',
  exchanges: '#c48ac9',
  page: '#9e8e72',
};

// Vogel's phyllotactic angle. The only rotation with no periodic alignment at
// any node count, which is why a sunflower head packs evenly whether it has
// thirteen seeds or three hundred. Here it means the sigil stays legible as
// the corpus grows without anyone retuning it.
const GOLDEN_ANGLE = 137.50776405003785;

export const VIEW = 120;
const CENTER = VIEW / 2;
const R_IN = 20; // inside this, the door dot
const R_OUT = 53; // close to the outermost dashed ring of the original sigil

// Radius leans on rank rather than calendar. Pure calendar spacing is right
// for the rhizome's vertical field, where a quiet summer should read as empty
// space, but on a disc it packs a burst of posts into an unreadable knot at
// one radius and leaves the rest of the face bare. Ordering is identical
// either way — that is the part the two views must agree on — so this is a
// spacing choice, not a second opinion about which node is newer.
const SIGIL_TIME_RANK_MIX = 0.82;

export interface SigilPoint {
  slug: string;
  title: string;
  url: string;
  collection: string;
  state: string;
  date: string | null;
  x: number;
  y: number;
  r: number;
  u: number;
  ageDays: number | null;
}

export interface SigilEdge {
  d: string;
  color: string;
}

export interface Sigil {
  points: SigilPoint[];
  edges: SigilEdge[];
  rings: number[];
}

/**
 * Lay the whole graph out as growth rings.
 *
 * Radius is time: center oldest, rim newest. This is dendrochronology and not
 * a clock face — the cambium is at the rim, so the disc widens as the corpus
 * does and a reader who comes back in three months can see that it grew.
 * Angle is phyllotactic by date rank. Undated nodes ride the innermost ring.
 */
export function buildSigil(graph: readonly Node[], now = Date.now()): Sigil {
  const uBySlug = temporalU(graph, SIGIL_TIME_RANK_MIX);

  // Date order fixes the angle, so the spiral winds outward in the order the
  // work was actually made rather than in whatever order the collections load.
  const ordered = [...graph].sort((a, b) => {
    const ua = uBySlug.get(a.slug);
    const ub = uBySlug.get(b.slug);
    if (ua === undefined && ub === undefined) return a.slug.localeCompare(b.slug);
    if (ua === undefined) return -1;
    if (ub === undefined) return 1;
    return ua - ub || a.slug.localeCompare(b.slug);
  });

  // Spin the whole spiral so the newest node lands at twelve o'clock. The mark
  // then has an orientation, and the freshest work is where the eye starts.
  const lastTheta = ((ordered.length - 1) * GOLDEN_ANGLE * Math.PI) / 180;
  const spin = -Math.PI / 2 - lastTheta;

  const points: SigilPoint[] = ordered.map((n, i) => {
    const u = uBySlug.get(n.slug) ?? 0;
    const radius = R_IN + (R_OUT - R_IN) * u;
    const theta = (i * GOLDEN_ANGLE * Math.PI) / 180 + spin;
    const degree = n.connects.length + n.backlinks.length;
    return {
      slug: n.slug,
      title: n.title,
      url: n.url,
      collection: n.collection,
      state: n.state,
      date: n.date ?? null,
      x: CENTER + radius * Math.cos(theta),
      y: CENTER + radius * Math.sin(theta),
      r: 1.1 + Math.sqrt(degree) * 0.42,
      u,
      ageDays: n.date ? (now - Date.parse(n.date)) / 86400000 : null,
    };
  });

  const bySlug = new Map(points.map((p) => [p.slug, p]));
  const seen = new Set<string>();
  const edges: SigilEdge[] = [];
  for (const n of graph) {
    for (const target of n.connects) {
      const a = bySlug.get(n.slug);
      const b = bySlug.get(target);
      if (!a || !b || a === b) continue;
      const key = a.slug < b.slug ? `${a.slug}|${b.slug}` : `${b.slug}|${a.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Bow each chord toward the center. Straight chords across a disc read
      // as a starburst; bowed ones read as a web, which is the truer picture.
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const cx = CENTER + (mx - CENTER) * 0.4;
      const cy = CENTER + (my - CENTER) * 0.4;
      edges.push({
        d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        color: SIGIL_COLORS[a.collection] ?? SIGIL_COLORS.page,
      });
    }
  }

  // Quarter gridlines, carrying over the dashed rings of the original mark.
  const rings = [0.25, 0.5, 0.75, 1].map((f) => R_IN + (R_OUT - R_IN) * f);

  return { points, edges, rings };
}
