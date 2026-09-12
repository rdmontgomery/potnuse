import { encodeCall, wordToAddress, wordToBigInt, words } from './feed/rpc.ts';
import type { EthCall } from './feed/types.ts';
import { TapeError, type Address, type Asset, type Market } from './types.ts';

/** decimals() */
const DECIMALS = '0x313ce567';
/** symbol() */
const SYMBOL = '0x95d89b41';
/** getPair(address,address) — Uniswap-V2 style factory */
const GET_PAIR = '0xe6a43905';

const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * Decode a `symbol()` return.
 *
 * Two encodings in the wild: a proper dynamic string (offset, length, bytes)
 * and a raw bytes32 from tokens that predate the standard settling. Guessing
 * wrong yields either mojibake or an exception on a token that is otherwise
 * fine, so both are handled and neither is fatal — a symbol is a label, and
 * failing to read one is no reason to refuse to price a pool.
 */
export function decodeSymbol(result: string): string {
  const body = result.replace(/^0x/, '');
  if (body.length === 0) return '???';

  const decodeHex = (hex: string) => {
    let out = '';
    for (let i = 0; i + 2 <= hex.length; i += 2) {
      const code = Number.parseInt(hex.slice(i, i + 2), 16);
      if (code > 0) out += String.fromCharCode(code);
    }
    return out;
  };

  // Dynamic string: first word is an offset (0x20 in every real case).
  if (body.length >= 128) {
    const offset = Number(BigInt(`0x${body.slice(0, 64)}`));
    if (offset === 32) {
      const length = Number(BigInt(`0x${body.slice(64, 128)}`));
      if (length > 0 && length <= 64) {
        const text = decodeHex(body.slice(128, 128 + length * 2));
        if (text.length > 0) return text;
      }
    }
  }
  // bytes32, right-padded with zeros.
  const text = decodeHex(body.slice(0, 64));
  return text.length > 0 ? text : '???';
}

/** Read the ERC-20 metadata needed to price a pool. */
export async function readAsset(
  call: EthCall,
  chainId: number,
  address: Address,
): Promise<Asset> {
  const decimals = Number(wordToBigInt(words(await call(address, encodeCall(DECIMALS)))[0]));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new TapeError(`${address} reports ${decimals} decimals, which is not a token`);
  }

  let symbol = '???';
  try {
    symbol = decodeSymbol(await call(address, encodeCall(SYMBOL)));
  } catch {
    // A token with no readable symbol is unusual, not disqualifying.
  }
  return { chainId, address, symbol, decimals };
}

/** Ask a Uniswap-V2 style factory for the pair holding both tokens. */
export async function findPair(
  call: EthCall,
  factory: Address,
  a: Address,
  b: Address,
): Promise<Address | null> {
  const result = await call(factory, encodeCall(GET_PAIR, [a, b]));
  const pair = wordToAddress(words(result)[0]);
  return pair.toLowerCase() === ZERO ? null : pair;
}

export interface DiscoverRequest {
  chainId: number;
  /** The token being traded. */
  base: Address;
  /** What it trades against — a stablecoin, an equity token, wrapped ETH. */
  quote: Address;
  venue?: string;
  /** Give a pool directly, or a factory to look one up. */
  pool?: Address;
  factory?: Address;
}

/**
 * Turn a pasted contract address into a market the runner can watch.
 *
 * This is the whole distance between "someone sent me a CA" and "the system
 * can price it": which pool, which side is which, how many decimals each. All
 * of it is on-chain and none of it should be typed by hand, because every one
 * of those fields is silently catastrophic when wrong — a decimals mistake
 * misprices by orders of magnitude and looks plausible the whole way.
 */
export async function discoverMarket(
  call: EthCall,
  request: DiscoverRequest,
): Promise<Market> {
  if (request.base.toLowerCase() === request.quote.toLowerCase()) {
    throw new TapeError('base and quote are the same token');
  }

  const pool =
    request.pool ??
    (request.factory
      ? await findPair(call, request.factory, request.base, request.quote)
      : null);

  if (!pool) {
    throw new TapeError(
      request.factory
        ? 'no pool exists for that pair on this factory'
        : 'give either a pool address or a factory to look one up',
    );
  }

  const [base, quote] = await Promise.all([
    readAsset(call, request.chainId, request.base),
    readAsset(call, request.chainId, request.quote),
  ]);

  return { base, quote, pool, venue: request.venue ?? 'uniswap-v2' };
}
