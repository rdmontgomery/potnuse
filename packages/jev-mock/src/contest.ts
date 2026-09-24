/**
 * Three models, one refund queue, one known truth.
 *
 * The question every model answers: is this refund request legitimate? On your
 * traffic 92% are; 8% are abuse. Approving an abusive one costs $5, denying a
 * legitimate one costs $20 in churn, right calls cost nothing.
 *
 * The truth is a probit latent: each ticket has z ~ N(mu, sigma^2), and it is
 * legitimate when z + eta > 0 with eta ~ N(0, 1), so P(legit | z) = Phi(z).
 * A model sees a noisy signal s = z + e, e ~ N(0, tau^2), and the Bayes
 * posterior P(legit | s) is closed-form. That gives forecasters that are
 * calibrated by construction, share a single truth, and differ only in tau —
 * how much each one knows. The distortions are then applied on top:
 *
 *   jevLike      tau small (knows a lot), honest, but trained where the base
 *                rate was 50%. Under label shift the fix is exact and needs no
 *                per-item labels: move the intercept by one log-odds ratio.
 *   llmLogprob   tau larger, read from token log-probs, cooled to T = 0.5 as
 *                preference tuning tends to leave it.
 *   llmVerbal    the SAME model and belief as llmLogprob, read out by asking it
 *                to state a confidence. It answers with round numbers, so its
 *                outputs collapse onto a dozen values, and items that share a
 *                value can never again be told apart by any recalibration.
 *
 * I set how much each model knows. What the contest measures is what that
 * knowledge is worth at $5/$20, and what a recalibration loop can and cannot
 * give back.
 */

import { normal, rng } from './rng.ts';

/** Abramowitz & Stegun 7.1.26 via erf; ~1e-7 absolute, plenty here. */
export function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (p: number) => Math.min(1 - 1e-9, Math.max(1e-9, p));

/** Confidence menu a chat model actually uses when asked for a number. */
export const VERBAL_MENU = [0.6, 0.7, 0.8, 0.85, 0.9, 0.95] as const;

export interface ContestOptions {
  n: number;
  seed?: number;
  /** P(legitimate) on your traffic. */
  baseRate?: number;
  /** P(legitimate) where the Jev-like model was trained. */
  trainingBaseRate?: number;
  /** Spread of the latent: how separable tickets are at all. */
  sigma?: number;
  tauJev?: number;
  tauLlm?: number;
  /** Temperature preference tuning left on the LLM's log-probs. */
  llmTemperature?: number;
}

export interface Contest {
  y: (0 | 1)[];
  /** P(legit | z): what a model that knew everything would say. */
  oracle: number[];
  /** Honest posteriors before any distortion — for checking, not for use. */
  honestJev: number[];
  honestLlm: number[];
  jevLike: number[];
  llmLogprob: number[];
  llmVerbal: number[];
  /** Logit shift that undoes the Jev-like model's training prior. */
  priorShift: number;
}

/** Latent mean that yields the requested base rate: Phi(mu / sqrt(1 + sigma^2)). */
function muFor(baseRate: number, sigma: number): number {
  let lo = -20, hi = 20;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (phi(mid / Math.sqrt(1 + sigma * sigma)) < baseRate) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function posterior(s: number, mu: number, sigma: number, tau: number): number {
  const k = (sigma * sigma) / (sigma * sigma + tau * tau);
  const m = mu + k * (s - mu);
  const v = (sigma * sigma * tau * tau) / (sigma * sigma + tau * tau);
  return phi(m / Math.sqrt(1 + v));
}

export function verbalize(p: number): number {
  const legit = p >= 0.5;
  const conf = Math.max(p, 1 - p);
  let best: number = VERBAL_MENU[0];
  for (const m of VERBAL_MENU) if (Math.abs(m - conf) < Math.abs(best - conf)) best = m;
  return legit ? best : 1 - best;
}

export function contest(opts: ContestOptions): Contest {
  const {
    n,
    seed = 1,
    baseRate = 0.92,
    trainingBaseRate = 0.5,
    sigma = 2,
    tauJev = 0.5,
    tauLlm = 1.2,
    llmTemperature = 0.5,
  } = opts;
  const r = rng(seed);
  const mu = muFor(baseRate, sigma);
  const priorShift = logit(baseRate) - logit(trainingBaseRate);

  const out: Contest = {
    y: [], oracle: [], honestJev: [], honestLlm: [],
    jevLike: [], llmLogprob: [], llmVerbal: [], priorShift,
  };

  for (let i = 0; i < n; i++) {
    const z = mu + sigma * normal(r);
    const y: 0 | 1 = z + normal(r) > 0 ? 1 : 0;
    const pj = posterior(z + tauJev * normal(r), mu, sigma, tauJev);
    const pl = posterior(z + tauLlm * normal(r), mu, sigma, tauLlm);
    const cooled = sigmoid(logit(clamp(pl)) / llmTemperature);

    out.y.push(y);
    out.oracle.push(phi(z));
    out.honestJev.push(pj);
    out.honestLlm.push(pl);
    // Trained at 50/50: under label shift its logit sits low by exactly priorShift.
    out.jevLike.push(sigmoid(logit(clamp(pj)) - priorShift));
    out.llmLogprob.push(cooled);
    out.llmVerbal.push(verbalize(cooled));
  }
  return out;
}

/** The label-free fix for a base-rate mismatch: one number, added to the logit. */
export function shiftPrior(p: number, shift: number): number {
  return sigmoid(logit(clamp(p)) + shift);
}
