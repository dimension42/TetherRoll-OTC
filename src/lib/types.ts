export type PoolStatus = 'DRAFT' | 'LOCKING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'HIDDEN';
export type TradeType = 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO';
export type PoolKind = 'SWAP' | 'FIAT';

/** Pool v2 — EscrowVault 기반 */
export interface Pool {
  id: string;
  kind: PoolKind;
  visibility: 'public' | 'vip';

  // v2 온체인 필드
  chain_id: number;
  maker_address: string;
  offer_token: string;
  request_token: string;
  offer_decimals: number;
  request_decimals: number;
  offer_amount_wei: string;
  request_amount_wei: string;
  offer_remaining_wei: string;
  allow_partial: boolean;
  fee_bps: number;
  onchain_pool_id: number | null;
  create_tx_hash: string | null;
  status: PoolStatus;
  expires_at: string | null;
  creator_id: string;

  // 레거시 표시 필드 (DB 편의)
  offer_symbol: string;
  request_symbol: string;
  offer_amount: string;        // 사람이 읽을 수 있는 양 (formatUnits 적용됨)
  request_amount: string;
  fiat_currency: string | null;
  trade_type: TradeType;
  collateral_mode: 'NONE' | 'KRW_SIDE_LOCKS';
  collateral_pct: number | null;

  created_at: string;
  updated_at: string;
}

export type TradeStatus = 'PENDING' | 'AWAITING_BOND' | 'ACTIVE' | 'PAID' | 'RELEASED' | 'CANCELLED' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED';

export interface Trade {
  id: string;
  kind: 'FIAT';
  chain_id: number;
  seller_id: string;
  buyer_id: string;
  seller_address: string;
  buyer_address: string;
  token: string;
  amount_wei: string | null;
  fiat_currency: string;
  fiat_amount: string;
  bond_token: string;
  bond_amount_wei: string;
  deadline: string;
  release_window_sec: number;
  paid_at: string | null;
  released_at: string | null;
  onchain_trade_id: number | null;
  evidence_hash: string | null;
  status: TradeStatus;
  tx_hash: string | null;
  pool_id: string;
  created_at: string;
  updated_at: string;
}

export interface BankInfo {
  bank: string;
  account: string;
  holder: string;
}
