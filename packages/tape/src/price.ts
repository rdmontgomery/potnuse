import type { Denom, Mark } from './types.ts';

/**
 * USD reference for a quote asset.
 *
 * The whole point of this indirection is that a stablecoin is not a special
 * case in the engine — it is just the source that always answers 1.
 */
export interface UsdReference {
  readonly label: string;
  /** USD per unit of the quote asset at time `t`, or null if unknown. */
  usdPerUnit(t: number): Promise<number | null>;
}

/** A quote asset pegged to the dollar. The degenerate, constant case. */
export function pegged(label = 'usd-peg', value = 1): UsdReference {
  return { label, usdPerUnit: async () => value };
}

/** No USD reference at all. Quote-denominated rules still work; USD ones do not. */
export const unreferenced: UsdReference = {
  label: 'none',
  usdPerUnit: async () => null,
};

/**
 * A quote asset whose dollar value floats — a tokenized equity, wrapped ETH,
 * another memecoin. `fetch` is whatever gets you a spot price; it is expected
 * to fail sometimes, and a failure must degrade to null rather than throw,
 * because a missing oracle print is not a reason to abandon a position.
 */
export function floating(
  label: string,
  fetch: (t: number) => Promise<number>,
  opts: { maxStaleMs?: number } = {},
): UsdReference {
  const maxStaleMs = opts.maxStaleMs ?? 5 * 60_000;
  let cached: { t: number; value: number } | null = null;

  return {
    label,
    async usdPerUnit(t: number) {
      if (cached && Math.abs(t - cached.t) <= maxStaleMs) return cached.value;
      try {
        const value = await fetch(t);
        if (!Number.isFinite(value) || value <= 0) return null;
        cached = { t, value };
        return value;
      } catch {
        // Serve a stale print rather than nothing, but only inside the window.
        if (cached && Math.abs(t - cached.t) <= maxStaleMs) return cached.value;
        return null;
      }
    },
  };
}

/**
 * The number the ladder actually compares against entry.
 *
 * Returns null when the requested denomination cannot be computed — a USD
 * rule against an unreferenced quote asset. Callers must treat null as
 * "no information this tick", not as zero.
 */
export function basis(mark: Mark, denom: Denom): number | null {
  if (denom === 'quote') return mark.quotePerBase;
  if (mark.usdPerQuote === null) return null;
  return mark.quotePerBase * mark.usdPerQuote;
}

/** Convenience: attach a USD reference print to a raw pool price. */
export async function markFrom(
  t: number,
  quotePerBase: number,
  ref: UsdReference,
): Promise<Mark> {
  return { t, quotePerBase, usdPerQuote: await ref.usdPerUnit(t) };
}
