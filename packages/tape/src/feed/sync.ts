import type { PoolState } from '../fills.ts';
import type { UsdReference } from '../price.ts';
import { TapeError, type Market } from '../types.ts';
import { words } from './rpc.ts';
import type { LogEntry, MarkFeed, Observation, RpcClient } from './types.ts';

/** keccak256("Sync(uint112,uint112)") */
export const SYNC_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1' as const;

/**
 * Reserves after every event the pair emitted, rather than spot prices at
 * whatever moment we happened to look.
 *
 * `Sync` fires on every swap, mint and burn, carrying the post-event reserves.
 * Reading it turns the tape from a sequence of points into the actual path,
 * which removes the single largest lie in the polled version: a wick through
 * the stop between two polls was previously invisible, and poll interval was
 * doing risk work it had no business doing.
 *
 * It also catches liquidity leaving. A burn that halves the pool prints here
 * exactly like a price move, because for an exit that is what it is.
 */
export interface SyncScan {
  observations: Observation[];
  /** Where to resume. Pass back as `fromBlock` on the next scan. */
  nextBlock: bigint;
  /** Blocks actually covered, for spotting a scan that fell behind. */
  scanned: { from: bigint; to: bigint };
}

export interface ScanOptions {
  /**
   * Blocks left unscanned at the head. A reorg rewrites recent history, and a
   * tape built from rewritten blocks describes a chain that no longer exists.
   */
  confirmations?: bigint;
  /** Largest range per `eth_getLogs`; providers cap this and the cap varies. */
  maxRange?: bigint;
  /** Stop after this many observations, so one catch-up cannot run forever. */
  maxObservations?: number;
}

/** Decode a Sync log into the reserves it carries, in token0/token1 order. */
export function decodeSync(log: LogEntry): { reserve0: bigint; reserve1: bigint } {
  if (log.topics[0] !== SYNC_TOPIC) throw new TapeError('not a Sync log');
  const parts = words(log.data);
  if (parts.length < 2) throw new TapeError('Sync log data too short');
  return { reserve0: BigInt(`0x${parts[0]}`), reserve1: BigInt(`0x${parts[1]}`) };
}

function priceOf(pool: PoolState): number {
  return (
    Number(pool.reserveQuote) / 10 ** pool.quoteDecimals /
    (Number(pool.reserveBase) / 10 ** pool.baseDecimals)
  );
}

/**
 * Scan a block range for reserve changes.
 *
 * Resumable by design: it returns where to pick up, so a runner that missed
 * six hours catches up rather than losing them. That property is what makes
 * the choice of host a convenience question instead of a reliability one — a
 * process that has to never miss a tick needs very different infrastructure
 * from one that can be restarted whenever.
 */
export async function scanSync(
  rpc: RpcClient,
  market: Market,
  usdRef: UsdReference,
  baseIsToken0: boolean,
  fromBlock: bigint,
  opts: ScanOptions = {},
): Promise<SyncScan> {
  const confirmations = opts.confirmations ?? 5n;
  const maxRange = opts.maxRange ?? 2_000n;
  const maxObservations = opts.maxObservations ?? 10_000;

  const head = await rpc.blockNumber();
  const safeHead = head > confirmations ? head - confirmations : 0n;
  if (fromBlock > safeHead) {
    return { observations: [], nextBlock: fromBlock, scanned: { from: fromBlock, to: fromBlock } };
  }

  const logs: LogEntry[] = [];
  let cursor = fromBlock;
  let covered = fromBlock;

  while (cursor <= safeHead && logs.length < maxObservations) {
    const to = cursor + maxRange - 1n > safeHead ? safeHead : cursor + maxRange - 1n;
    logs.push(
      ...(await rpc.getLogs({
        address: market.pool,
        topics: [SYNC_TOPIC],
        fromBlock: cursor,
        toBlock: to,
      })),
    );
    covered = to;
    cursor = to + 1n;
  }

  logs.sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex - b.logIndex
      : a.blockNumber < b.blockNumber
        ? -1
        : 1,
  );
  const capped = logs.slice(0, maxObservations);
  const timestamps = await rpc.blockTimestamps(capped.map((log) => log.blockNumber));

  const observations: Observation[] = [];
  for (const log of capped) {
    const { reserve0, reserve1 } = decodeSync(log);
    const pool: PoolState = {
      reserveBase: baseIsToken0 ? reserve0 : reserve1,
      reserveQuote: baseIsToken0 ? reserve1 : reserve0,
      baseDecimals: market.base.decimals,
      quoteDecimals: market.quote.decimals,
    };
    // A pool emptied on one side has no price. Skip rather than divide by zero;
    // the gap in the tape is the honest record of what happened.
    if (pool.reserveBase <= 0n || pool.reserveQuote <= 0n) continue;

    const t = timestamps.get(log.blockNumber);
    if (t === undefined) throw new TapeError(`no timestamp for block ${log.blockNumber}`);

    observations.push({
      mark: { t, quotePerBase: priceOf(pool), usdPerQuote: await usdRef.usdPerUnit(t) },
      pool,
    });
  }

  // Resume after the last log consumed, not after the range scanned, or a
  // truncated catch-up silently drops everything it did not get to.
  const last = capped.at(-1);
  const nextBlock =
    capped.length === maxObservations && last !== undefined ? last.blockNumber + 1n : covered + 1n;

  return { observations, nextBlock, scanned: { from: fromBlock, to: covered } };
}

/**
 * A `MarkFeed` over Sync logs.
 *
 * Same port as the polled feed, so `paperSession` cannot tell them apart: the
 * runner is unchanged and a polled tape and a log-derived tape are directly
 * comparable. Each `poll` drains one buffered observation and refills from the
 * chain when empty, so the caller's loop shape does not change either.
 */
export function syncFeed(
  rpc: RpcClient,
  market: Market,
  usdRef: UsdReference,
  baseIsToken0: boolean,
  startBlock: bigint,
  opts: ScanOptions = {},
): MarkFeed & { cursor: () => bigint } {
  let nextBlock = startBlock;
  let buffer: Observation[] = [];

  return {
    market,
    cursor: () => nextBlock,
    async poll(): Promise<Observation | null> {
      if (buffer.length === 0) {
        const scan = await scanSync(rpc, market, usdRef, baseIsToken0, nextBlock, opts);
        nextBlock = scan.nextBlock;
        buffer = scan.observations;
      }
      return buffer.shift() ?? null;
    },
  };
}
