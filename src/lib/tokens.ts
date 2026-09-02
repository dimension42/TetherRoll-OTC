import type { Address } from 'viem';
import { ZERO_ADDRESS } from '@/lib/contracts/addresses';

export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;      // ZERO_ADDRESS = 네이티브
  decimals: number;
  logo?: string;         // /public 경로 또는 이모지
}

/**
 * 체인별 토큰 화이트리스트. 서버(풀 생성 검증)와 클라이언트(선택 UI)가 같은 파일을 쓴다.
 * 주소는 lowercase 로 비교한다 — `findToken()` 사용.
 */
export const TOKENS: Record<number, TokenInfo[]> = {
  11155111: [
    { symbol: 'ETH', name: 'Sepolia Ether', address: ZERO_ADDRESS, decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin (Circle test)', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    { symbol: 'USDT', name: 'Tether USD (test)', address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', decimals: 6 },
    { symbol: 'WETH', name: 'Wrapped Ether', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
  ],
  137: [
    { symbol: 'POL', name: 'Polygon Ecosystem Token', address: ZERO_ADDRESS, decimals: 18 },
    { symbol: 'USDT', name: 'Tether USD', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    { symbol: 'USDC.e', name: 'Bridged USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    { symbol: 'WETH', name: 'Wrapped Ether', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
    { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8 },
  ],
  56: [
    { symbol: 'BNB', name: 'BNB', address: ZERO_ADDRESS, decimals: 18 },
    { symbol: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    { symbol: 'ETH', name: 'Binance-Peg ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
    { symbol: 'BTCB', name: 'Binance-Peg BTC', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 },
  ],
  1: [
    { symbol: 'ETH', name: 'Ether', address: ZERO_ADDRESS, decimals: 18 },
    { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  ],
};

export function tokensFor(chainId: number): TokenInfo[] {
  return TOKENS[chainId] ?? [];
}

export function findToken(chainId: number, address: string): TokenInfo | undefined {
  const a = address.toLowerCase();
  return tokensFor(chainId).find(t => t.address.toLowerCase() === a);
}

export function isNative(address: string): boolean {
  return address.toLowerCase() === ZERO_ADDRESS;
}

/** Roll Order 지급 체인 (TRC-20 포함 — EVM 아님, 서버 기록 전용) */
export const ROLL_CHAINS = [
  { key: 'TRC20', label: 'Tron (TRC-20)', evm: false, gasEstimateKrw: 1500 },
  { key: 'POLYGON', label: 'Polygon', evm: true, chainId: 137, gasEstimateKrw: 30 },
  { key: 'BSC', label: 'BNB Chain', evm: true, chainId: 56, gasEstimateKrw: 300 },
  { key: 'ERC20', label: 'Ethereum', evm: true, chainId: 1, gasEstimateKrw: 8000 },
] as const;
export type RollChainKey = (typeof ROLL_CHAINS)[number]['key'];

export const FIAT_CURRENCIES = [
  { code: 'KRW', name: 'Korean Won', symbol: '₩' },
] as const;
