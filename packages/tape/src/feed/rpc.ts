import { TapeError, type Address } from '../types.ts';
import type { EthCall } from './types.ts';

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
