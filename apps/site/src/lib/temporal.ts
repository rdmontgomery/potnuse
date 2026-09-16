// Shared temporal coordinate for every view that arranges the graph by time:
// the rhizome's vertical field and the door sigil's radius. Both must agree —
// a node that reads as newer on one and older on the other is worse than
// either view alone, so the computation lives here and nowhere else.

export const TIME_RANK_MIX = 0.5; // 0 = pure calendar spacing, 1 = pure rank order
export const MIN_GAP = 0.07; // floor on the gap between consecutive distinct dates

export interface Dated {
  slug: string;
  date?: string | null;
}

/**
 * Map each dated node to `u` in [0, 1] — 0 oldest, 1 newest.
 *
 * Pure calendar spacing collapses a burst of posts into one indistinguishable
 * band; pure rank spaces them evenly and lies about the quiet months. The blend
 * keeps both legible. The floor then guarantees that two distinct dates are
 * separated by enough to survive whatever noise the consuming view adds — link
 * tension in the force layout, label collision in the sigil — while same-day
 * nodes collapse to an identical `u`, because they are the same day and any
 * ordering between them would be invented.
 *
 * Undated nodes are absent from the returned map; callers decide where those go.
 *
 * `timeRankMix` is a per-view display choice, not a disagreement: every mix
 * produces the same *ordering*, which is the invariant the views must share.
 * Only the spacing changes. The rhizome field wants calendar truth, so quiet
 * months read as gaps. The sigil wants ring legibility, so it leans on rank.
 */
export function temporalU(
  nodes: readonly Dated[],
  timeRankMix = TIME_RANK_MIX,
): Map<string, number> {
  const dated = nodes.filter((n) => n.date);
  const out = new Map<string, number>();
  if (dated.length === 0) return out;

  const byTime = [...dated].sort(
    (a, b) => Date.parse(a.date!) - Date.parse(b.date!),
  );
  if (byTime.length === 1) {
    out.set(byTime[0].slug, 1);
    return out;
  }

  const tMin = Date.parse(byTime[0].date!);
  const tMax = Date.parse(byTime[byTime.length - 1].date!);
  const tSpan = Math.max(1, tMax - tMin);

  const u = byTime.map((n, i) => {
    const timeNorm = (Date.parse(n.date!) - tMin) / tSpan;
    const rankNorm = i / (byTime.length - 1);
    return (1 - timeRankMix) * timeNorm + timeRankMix * rankNorm;
  });

  for (let i = 1; i < byTime.length; i++) {
    u[i] =
      byTime[i].date === byTime[i - 1].date
        ? u[i - 1]
        : Math.max(u[i], u[i - 1] + MIN_GAP);
  }

  const uMin = u[0];
  const uSpan = Math.max(1e-6, u[u.length - 1] - uMin);
  byTime.forEach((n, i) => out.set(n.slug, (u[i] - uMin) / uSpan));
  return out;
}
