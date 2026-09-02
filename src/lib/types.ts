/**
 * Pool/Trade 타입 정의 (API 응답 스키마).
 * 프론트엔드가 import한다.
 *
 * ── Fiat Pool Storage Canonical Rule (B-01 fix) ──
 * SWAP: offer_token, request_token 둘 다 컨트랙트 주소 (또는 0x0 = native)
 * FIAT with trade_type CRYPTO_FIAT: offer = crypto token, request_symbol = fiat currency code (e.g. 'KRW'), request_amount = fiat amount
 * FIAT with trade_type FIAT_CRYPTO: offer_symbol = fiat code, offer_amount = fiat amount, request = crypto token
 */

export type PoolStatus = 'DRAFT' | 'LOCKING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'MATCHED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED' | 'HIDDEN';
export type PoolKind = 'SWAP' | 'FIAT';
export type TradeType = 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO';

export interface Pool {
  id: string;
  visibility: 'public' | 'vip';
  kind: PoolKind;
  trade_type?: TradeType; // legacy (0001 schema)
  offer_symbol?: string; // legacy
  offer_chain?: string | null;
  offer_amount?: number; // legacy
  request_symbol?: string; // legacy
  request_chain?: string | null;
  request_amount?: number; // legacy
  fiat_currency?: string | null;
  collateral_mode?: 'NONE' | 'KRW_SIDE_LOCKS';
  collateral_pct?: number | null;
  // v2 확장 필드
  chain_id: number;
  maker_address?: string;
  offer_token?: string; // address (0x0 = native)
  request_token?: string;
  offer_decimals?: number;
  request_decimals?: number;
  offer_amount_wei?: string; // bigint string
  request_amount_wei?: string;
  offer_remaining_wei?: string;
  allow_partial?: boolean;
  fee_bps?: number;
  onchain_pool_id?: number;
  create_tx_hash?: string;
  taken_count?: number;
  status: PoolStatus;
  filled_pct?: number; // legacy
  expires_at: string | null;
  created_at: string;
}

export type TradeStatus = 'PENDING' | 'AWAITING_BOND' | 'ACTIVE' | 'PAID' | 'RELEASED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'FAILED';
export type TradeKind = 'SWAP' | 'FIAT';

export interface Trade {
  id: string;
  pool_id?: string;
  kind: TradeKind;
  chain_id: number;
  maker_id?: string;
  taker_id?: string;
  maker_address?: string;
  taker_address?: string;
  // SWAP
  offer_out_wei?: string;
  request_in_wei?: string;
  fee_offer_wei?: string;
  fee_request_wei?: string;
  // FIAT
  seller_id?: string;
  buyer_id?: string;
  seller_address?: string;
  buyer_address?: string;
  token?: string;
  amount_wei?: string;
  fiat_currency?: string;
  fiat_amount?: string;
  bond_token?: string;
  bond_amount_wei?: string;
  bank_info_enc?: string; // 서버에서 조건부 복호화
  deadline?: string;
  release_window_sec?: number;
  paid_at?: string;
  released_at?: string;
  onchain_trade_id?: number;
  evidence_hash?: string;
  status: TradeStatus;
  tx_hash?: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  address: string;
  label?: string;
  source: 'siwe' | 'privy_embedded' | 'manual';
  verified_at?: string;
  is_primary: boolean;
  created_at: string;
}

export interface OnchainTx {
  id: string;
  user_id?: string;
  chain_id: number;
  hash: string;
  kind: string;
  ref_type?: string;
  ref_id?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  block_number?: number;
  gas_used?: string;
  created_at: string;
  confirmed_at?: string;
}
