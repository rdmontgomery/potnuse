import { TapeError, type Address } from '../types.ts';
import type { EthCall, LogEntry, LogFilter, RpcClient } from './types.ts';

/**
 * An `EthCall` over plain JSON-RPC.
 *
 * No dependency, no key management, no signer — this reads and cannot write.
 * That property is the reason tiers two and three can live in a repository
 * that also builds a website: there is nothing here to steal.
 */
export function jsonRpc(url: string, opts: { timeoutMs?: number } = {}): EthCall {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let id = 0;

  return async (to, data) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: (id += 1),
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) throw new TapeError(`rpc ${response.status} from ${url}`);
    const body = (await response.json()) as { result?: string; error?: { message: string } };
    if (body.error) throw new TapeError(`rpc error: ${body.error.message}`);
    if (typeof body.result !== 'string') throw new TapeError('rpc returned no result');
    return body.result as `0x${string}`;
  };
}

const pad = (value: string) => value.replace(/^0x/, '').padStart(64, '0');

/** ABI-encode a call to a selector with uint/address arguments. */
export function encodeCall(selector: string, args: (bigint | Address)[] = []): `0x${string}` {
  const encoded = args
    .map((arg) => (typeof arg === 'bigint' ? pad(arg.toString(16)) : pad(arg.toLowerCase())))
    .join('');
  return `${selector}${encoded}` as `0x${string}`;
}

/** Split a returndata blob into 32-byte words. */
export function words(result: string): string[] {
  const body = result.replace(/^0x/, '');
  const out: string[] = [];
  for (let i = 0; i + 64 <= body.length; i += 64) out.push(body.slice(i, i + 64));
  return out;
}

export function wordToBigInt(word: string | undefined): bigint {
  if (word === undefined) throw new TapeError('returndata too short');
  return BigInt(`0x${word}`);
}

export function wordToAddress(word: string | undefined): Address {
  if (word === undefined) throw new TapeError('returndata too short');
  return `0x${word.slice(24)}` as Address;
}

const hex = (value: bigint) => `0x${value.toString(16)}`;

/** Full RPC client over JSON-RPC. Reads only; there is no write method here. */
export function jsonRpcClient(url: string, opts: { timeoutMs?: number } = {}): RpcClient {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let id = 0;

  async function send<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: (id += 1), method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new TapeError(`rpc ${response.status} from ${url}`);
    const body = (await response.json()) as { result?: T; error?: { message: string } };
    if (body.error) throw new TapeError(`${method}: ${body.error.message}`);
    if (body.result === undefined) throw new TapeError(`${method} returned no result`);
    return body.result;
  }

  return {
    call: (to, data) => send<`0x${string}`>('eth_call', [{ to, data }, 'latest']),

    async getLogs(filter: LogFilter) {
      const raw = await send<
        {
          address: Address;
          topics: `0x${string}`[];
          data: `0x${string}`;
          blockNumber: string;
          logIndex: string;
          transactionHash: `0x${string}`;
        }[]
      >('eth_getLogs', [
        {
          address: filter.address,
          topics: filter.topics,
          fromBlock: hex(filter.fromBlock),
          toBlock: hex(filter.toBlock),
        },
      ]);

      return raw.map<LogEntry>((entry) => ({
        address: entry.address,
        topics: entry.topics,
        data: entry.data,
        blockNumber: BigInt(entry.blockNumber),
        logIndex: Number(entry.logIndex),
        transactionHash: entry.transactionHash,
      }));
    },

    async blockNumber() {
      return BigInt(await send<string>('eth_blockNumber', []));
    },

    async blockTimestamps(blocks: bigint[]) {
      const unique = [...new Set(blocks.map((block) => block.toString()))];
      const found = new Map<bigint, number>();
      // Sequential on purpose: an RPC that rate-limits a burst of header reads
      // will drop some of them, and a tape with holes in its timestamps is
      // worse than a tape that took longer to build.
      for (const block of unique) {
        const header = await send<{ timestamp: string }>('eth_getBlockByNumber', [
          hex(BigInt(block)),
          false,
        ]);
        found.set(BigInt(block), Number(BigInt(header.timestamp)) * 1000);
      }
      return found;
    },
  };
}
