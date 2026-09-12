import { encodeCall, wordToBigInt, words } from './feed/rpc.ts';
import type { EthCall } from './feed/types.ts';
import type { Address } from './types.ts';

/** decimals() */
const DECIMALS = '0x313ce567';

export interface ChainProfile {
  id: number;
  name: string;
  rpcUrl: string;
  /**
   * Where to ask which pools hold a token. `{token}` is substituted.
   *
   * Best-effort and unverified: whatever comes back is checked against the
   * chain, so a wrong slug costs a slower path rather than a wrong answer.
   */
  indexer?: string;
}

const gecko = (network: string) =>
  `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/{token}/pools`;

/**
 * Chains worth trying, in the order worth trying them.
 *
 * Public endpoints only, and each one is the chain's own documented RPC rather
 * than a third party, so nothing here depends on a provider key or on a
 * service that can quietly start rate-limiting a stranger.
 */
export const CHAINS: ChainProfile[] = [
  {
    id: 4663,
    name: 'Robinhood Chain',
    rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
    indexer: gecko('robinhood'),
  },
  { id: 1, name: 'Ethereum', rpcUrl: 'https://cloudflare-eth.com', indexer: gecko('eth') },
  { id: 8453, name: 'Base', rpcUrl: 'https://mainnet.base.org', indexer: gecko('base') },
  {
    id: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    indexer: gecko('arbitrum'),
  },
];

export function chainById(id: number): ChainProfile | undefined {
  return CHAINS.find((chain) => chain.id === id);
}

export interface ChainProbe {
  chain: ChainProfile;
  /** Decimals the token reported, or null if it is not a token here. */
  decimals: number | null;
}

/**
 * Work out which chain an address lives on by asking each one.
 *
 * A contract address carries no chain information — the same twenty bytes are
 * a valid address everywhere, and asking a person which chain a ticker came
 * from is asking them to know something the group chat never said. One
 * `decimals()` call per chain settles it.
 *
 * Chains are probed in parallel and every answer is returned, because a token
 * really can be deployed at the same address on several chains and picking one
 * silently would be worse than saying so.
 */
export async function probeChains(
  token: Address,
  callFor: (chain: ChainProfile) => EthCall,
  chains: ChainProfile[] = CHAINS,
): Promise<ChainProbe[]> {
  return Promise.all(
    chains.map(async (chain): Promise<ChainProbe> => {
      try {
        const raw = await callFor(chain)(token, encodeCall(DECIMALS));
        const decimals = Number(wordToBigInt(words(raw)[0]));
        const plausible = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36;
        return { chain, decimals: plausible ? decimals : null };
      } catch {
        return { chain, decimals: null };
      }
    }),
  );
}

export function chainsHolding(probes: ChainProbe[]): ChainProfile[] {
  return probes.filter((probe) => probe.decimals !== null).map((probe) => probe.chain);
}
