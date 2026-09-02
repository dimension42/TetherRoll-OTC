import { mainnet, polygon, bsc, sepolia, type Chain } from 'viem/chains';

/** 지원 체인. 순서 = UI 노출 순서. */
export const SUPPORTED_CHAINS: readonly Chain[] = [sepolia, polygon, bsc, mainnet] as const;
export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map(c => c.id);

export const CHAIN_META: Record<number, { name: string; short: string; explorer: string; nativeSymbol: string; testnet: boolean }> = {
  11155111: { name: 'Sepolia', short: 'SEP', explorer: 'https://sepolia.etherscan.io', nativeSymbol: 'ETH', testnet: true },
  137: { name: 'Polygon', short: 'POL', explorer: 'https://polygonscan.com', nativeSymbol: 'POL', testnet: false },
  56: { name: 'BNB Chain', short: 'BSC', explorer: 'https://bscscan.com', nativeSymbol: 'BNB', testnet: false },
  1: { name: 'Ethereum', short: 'ETH', explorer: 'https://etherscan.io', nativeSymbol: 'ETH', testnet: false },
};

export function chainById(chainId: number): Chain | undefined {
  return SUPPORTED_CHAINS.find(c => c.id === chainId);
}

export function isSupportedChain(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

/** 서버 전용 RPC URL. 미설정 시 viem 기본 퍼블릭 RPC. */
export function rpcUrl(chainId: number): string | undefined {
  const map: Record<number, string | undefined> = {
    11155111: process.env.SEPOLIA_RPC_URL,
    137: process.env.POLYGON_RPC_URL,
    56: process.env.BSC_RPC_URL,
    1: process.env.ETHEREUM_RPC_URL,
  };
  return map[chainId] || undefined;
}

export function txUrl(chainId: number, hash: string): string {
  return `${CHAIN_META[chainId]?.explorer ?? ''}/tx/${hash}`;
}

export function addressUrl(chainId: number, address: string): string {
  return `${CHAIN_META[chainId]?.explorer ?? ''}/address/${address}`;
}
