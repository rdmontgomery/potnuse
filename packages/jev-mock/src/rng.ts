/** Seeded randomness. A mock that is not reproducible is a flaky test with
 *  extra steps. */

export interface Rng {
  /** Uniform on [0, 1). */
  (): number;
}

/** mulberry32. Small, fast, good enough for simulation; not for crypto. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal, Box-Muller. */
export function normal(r: Rng): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Gamma(shape, 1), Marsaglia-Tsang. Shape may be < 1. */
export function gamma(r: Rng, shape: number): number {
  if (shape < 1) return gamma(r, shape + 1) * Math.pow(r(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(r);
    const v = 1 + c * x;
    if (v <= 0) continue;
    const v3 = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v3;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v3 + Math.log(v3))) return d * v3;
  }
}

/** Beta(a, b) via two Gammas. */
export function beta(r: Rng, a: number, b: number): number {
  const x = gamma(r, a);
  const y = gamma(r, b);
  return x / (x + y);
}

/** Dirichlet(alpha), returned as a normalized vector of the same length.
 *  alpha < 1 concentrates mass on one component: most items are easy. */
export function dirichlet(r: Rng, alpha: number[]): number[] {
  const g = alpha.map((a) => gamma(r, a));
  const sum = g.reduce((s, x) => s + x, 0);
  return g.map((x) => x / sum);
}

/** Draw an index from a normalized weight vector. */
export function categorical(r: Rng, weights: number[]): number {
  const u = r();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (u < acc) return i;
  }
  return weights.length - 1;
}
