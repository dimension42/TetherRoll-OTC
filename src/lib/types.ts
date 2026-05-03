export type PoolStatus = 'OPEN' | 'PARTIAL' | 'MATCHED' | 'CANCELLED' | 'COMPLETED';
export type EscrowStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
export type TradeType = 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO';

export interface Pool {
  id: string;
  poolId: number;
  creator: string;
  offerToken: string;
  offerSymbol: string;
  offerAmount: string;
  requestToken: string;
  requestSymbol: string;
  requestAmount: string;
  isFiat: boolean;
  fiatCurrency?: string;
  fiatAmount?: string;
  depositAmount: string;
  status: PoolStatus;
  filledPercent: number;
  createdAt: number;
  expiresAt: number;
  tradeType: TradeType;
  chainId: number;
  txHash?: string;
}

export interface Escrow {
  id: string;
  escrowId: number;
  poolId: number;
  partyA: string;
  partyB: string;
  assetASymbol: string;
  assetAAmount: string;
  assetBSymbol: string;
  assetBAmount: string;
  status: EscrowStatus;
  deadline: number;
  feeAmount: string;
  penaltyAmount: string;
  isFiat: boolean;
  fiatCurrency?: string;
  createdAt: number;
  chainId: number;
}

export interface Transaction {
  hash: string;
  type: 'POOL_CREATED' | 'ESCROW_CREATED' | 'ESCROW_COMPLETED' | 'DISPUTE_RAISED' | 'CANCELLED';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  chainId: number;
}

export interface AdminStats {
  totalPools: number;
  activePools: number;
  totalEscrows: number;
  activeEscrows: number;
  disputedEscrows: number;
  totalVolume: string;
  totalFees: string;
  totalUsers: number;
}
