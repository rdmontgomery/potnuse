import { TapeError, type Market } from './types.ts';
import { floating, pegged, unreferenced, type UsdReference } from './price.ts';
import type { FeeSchedule } from './fills.ts';
import type { LadderPlan } from './ladder.ts';
import type { BankrollConfig } from './bankroll.ts';
import type { ScreenFacts, ScreenPolicy } from './screen.ts';

/**
 * How the quote asset is priced in dollars.
 *
 * `http` exists so the quote asset can be anything without this package
 * knowing about any particular data vendor: point it at a JSON endpoint and
 * name the path to the number.
 */
export type UsdRefConfig =
  | { kind: 'pegged'; value?: number }
  | { kind: 'none' }
  | { kind: 'http'; url: string; path: string; maxStaleMs?: number };

export interface TapeConfig {
  rpcUrl: string;
  market: Market;
  usdRef: UsdRefConfig;
  fees: FeeSchedule;
  plan: LadderPlan;
  bankroll: BankrollConfig;
  screen?: Omit<ScreenPolicy, 'intendedSizeUsd'>;
  /** Everything the screen cannot read off the pool. Unset stays unknown. */
  facts?: Partial<Omit<ScreenFacts, 'market' | 'pool' | 'fees'>>;
  pollMs?: number;
  latencyHaircutBps?: number;
  journalPath?: string;
}

function pluck(body: unknown, path: string): number {
  let cursor: unknown = body;
  for (const segment of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object') {
      throw new TapeError(`price path '${path}' missed at '${segment}'`);
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  if (typeof cursor !== 'number') throw new TapeError(`price path '${path}' is not a number`);
  return cursor;
}

export function usdReference(config: UsdRefConfig): UsdReference {
  if (config.kind === 'pegged') return pegged('peg', config.value ?? 1);
  if (config.kind === 'none') return unreferenced;
  return floating(
    config.url,
    async () => pluck(await (await fetch(config.url)).json(), config.path),
    { maxStaleMs: config.maxStaleMs },
  );
}

/** What the screen should assume about facts nobody supplied: nothing. */
export function factsFrom(config: TapeConfig): Omit<ScreenFacts, 'market' | 'pool' | 'fees'> {
  const supplied = config.facts ?? {};
  return {
    usdPerQuote: supplied.usdPerQuote ?? null,
    quoteKind: supplied.quoteKind ?? (config.usdRef.kind === 'pegged' ? 'stable' : config.usdRef.kind === 'none' ? 'unreferenced' : 'floating'),
    quoteVolatilityPct: supplied.quoteVolatilityPct ?? null,
    sourceVerified: supplied.sourceVerified ?? null,
    ownerRenounced: supplied.ownerRenounced ?? null,
    canMint: supplied.canMint ?? null,
    topHolderPct: supplied.topHolderPct ?? null,
    holders: supplied.holders ?? null,
    lpLockedPct: supplied.lpLockedPct ?? null,
    ageMs: supplied.ageMs ?? null,
  };
}
