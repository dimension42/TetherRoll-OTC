export type PoolStatus = 'OPEN' | 'PARTIAL' | 'MATCHED' | 'CANCELLED' | 'COMPLETED' | 'HIDDEN';
export type TradeType = 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO';

export interface Pool {
  id: string;
  visibility: 'public' | 'vip';
  trade_type: TradeType;
  offer_symbol: string;
  offer_chain: string | null;
  offer_amount: number;
  request_symbol: string;
  request_chain: string | null;
  request_amount: number;
  fiat_currency: string | null;
  collateral_mode: 'NONE' | 'KRW_SIDE_LOCKS';
  collateral_pct: number | null;
  status: PoolStatus;
  filled_pct: number;
  chain_id: number | null;
  expires_at: string | null;
  created_at: string;
}
