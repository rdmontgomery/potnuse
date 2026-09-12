import type { PoolState } from '../fills.ts';
import type { Address, Mark, Market } from '../types.ts';

export interface Observation {
  mark: Mark;
  pool: PoolState;
}

/**
 * Where marks come from. Deliberately the narrowest possible port: a replay
 * off disk and a live pool read are the same shape, so the paper runner cannot
 * tell them apart and a live week can be re-run offline against a changed plan.
 */
export interface MarkFeed {
  readonly market: Market;
  /** Latest observation, or null when the source has nothing (or is exhausted). */
  poll(t: number): Promise<Observation | null>;
}

/**
 * Minimal Ethereum RPC surface: one `eth_call`.
 *
 * Typed as a bare function rather than pulling in a client library so this
 * package stays dependency-free and the reader below is testable without a
 * network. Wire viem, ethers or raw fetch to it in one line.
 */
export type EthCall = (to: Address, data: `0x${string}`) => Promise<`0x${string}`>;
