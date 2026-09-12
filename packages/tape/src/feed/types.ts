import type { PoolState } from '../fills.ts';
import type { Address, Mark, Market } from '../types.ts';

export interface Observation {
  mark: Mark;
  pool: PoolState;
  /**
   * Block this observation came from, where the source knows it.
   *
   * Carried so a consumer that stops early can resume from the first
   * observation it did NOT process. Without it a cursor can only report what
   * was scanned, and anything scanned-but-undrained is skipped for good.
   */
  block?: bigint;
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

export interface LogEntry {
  address: Address;
  topics: `0x${string}`[];
  data: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
}

export interface LogFilter {
  address: Address;
  topics: (`0x${string}` | null)[];
  fromBlock: bigint;
  toBlock: bigint;
}

/**
 * The RPC surface the log scanner needs, beyond a bare `eth_call`.
 *
 * Still a plain structural type with no client library behind it, so a fake in
 * a test and a live node are interchangeable and this package keeps its only
 * dependency being `fetch`.
 */
export interface RpcClient {
  call: EthCall;
  getLogs(filter: LogFilter): Promise<LogEntry[]>;
  blockNumber(): Promise<bigint>;
  /** Timestamps in epoch milliseconds, keyed by block number. */
  blockTimestamps(blocks: bigint[]): Promise<Map<bigint, number>>;
}
