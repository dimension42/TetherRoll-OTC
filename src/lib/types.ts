/**
 * Pool / Trade / Wallet / OnchainTx 타입 (API 응답 스키마). 프론트·백엔드 공용.
 *
 * ── Fiat Pool 저장 규약 (B-01 확정) ──
 * SWAP              : offer_token / request_token 둘 다 컨트랙트 주소 (0x0 = 네이티브)
 * FIAT CRYPTO_FIAT  : offer = 크립토 토큰, request_symbol = 'KRW', request_amount(_wei) = 원화 정수
 * FIAT FIAT_CRYPTO  : offer_symbol = 'KRW', offer_amount(_wei) = 원화 정수, request = 크립토 토큰
 */

export type PoolStatus =
  | 'DRAFT' | 'LOCKING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'MATCHED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED' | 'HIDDEN';
export type PoolKind = 'SWAP' | 'FIAT' | 'DESK';
export type TradeType = 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO';

/** Pool v2 — EscrowVault 기반. 온체인 락 전(DRAFT/FIAT 광고)에는 온체인 필드가 null 일 수 있다. */
export interface Pool {
  id: string;
  kind: PoolKind;
  visibility: 'public' | 'vip';
  creator_id: string | null;

  // v2 온체인 필드
  chain_id: number;
  maker_address: string | null;
  offer_token: string | null;
  request_token: string | null;
  offer_decimals: number | null;
  request_decimals: number | null;
  offer_amount_wei: string | null;
  request_amount_wei: string | null;
  offer_remaining_wei: string | null;
  allow_partial: boolean;
  fee_bps: number | null;
  onchain_pool_id: number | null;
  create_tx_hash: string | null;
  close_tx_hash?: string | null;
  taken_count?: number;
  status: PoolStatus;
  expires_at: string | null;

  // 레거시 표시 필드
  trade_type: TradeType | null;
  offer_symbol: string | null;
  request_symbol: string | null;
  offer_amount: number | string | null;   // 사람이 읽는 양
  request_amount: number | string | null;
  offer_chain?: string | null;
  request_chain?: string | null;
  fiat_currency: string | null;
  collateral_mode: 'NONE' | 'KRW_SIDE_LOCKS';
  collateral_pct: number | null;
  filled_pct?: number;

  created_at: string;
  updated_at?: string;
}

export type TradeStatus =
  | 'PENDING' | 'AWAITING_BOND' | 'ACTIVE' | 'PAID' | 'RELEASED' | 'CONFIRMED'
  | 'CANCELLED' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'FAILED'
  | 'AWAITING_DEPOSITS' | 'DEPOSITED' | 'PAYOUT_PENDING' | 'COMPLETED' | 'REFUNDING' | 'REFUNDED';
export type TradeKind = 'SWAP' | 'FIAT' | 'DESK';

export interface Trade {
  id: string;
  pool_id: string | null;
  kind: TradeKind;
  chain_id: number;
  status: TradeStatus;
  tx_hash: string | null;
  created_at: string;
  updated_at?: string;

  // SWAP (maker = 풀 생성자, taker = 체결자)
  maker_id?: string | null;
  taker_id?: string | null;
  maker_address?: string | null;
  taker_address?: string | null;
  offer_out_wei?: string | null;
  request_in_wei?: string | null;
  fee_offer_wei?: string | null;
  fee_request_wei?: string | null;

  // FIAT (seller = 크립토 락, buyer = KRW 송금)
  seller_id?: string | null;
  buyer_id?: string | null;
  seller_address?: string | null;
  buyer_address?: string | null;
  token?: string | null;
  amount_wei?: string | null;
  fiat_currency?: string | null;
  fiat_amount?: string | null;
  bond_token?: string | null;
  bond_amount_wei?: string | null;
  deadline?: string | null;
  release_window_sec?: number | null;
  paid_at?: string | null;
  released_at?: string | null;
  onchain_trade_id?: number | null;
  evidence_hash?: string | null;
  bank_info_enc?: string; // 서버에서만 복호화, 응답에는 포함하지 않음
}

export interface BankInfo {
  bank: string;
  account: string;
  holder: string;
}

export interface Wallet {
  id: string;
  address: string;
  label?: string | null;
  source: 'siwe' | 'privy_embedded' | 'manual';
  verified_at?: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface OnchainTx {
  id: string;
  user_id?: string | null;
  chain_id: number;
  hash: string;
  kind: string;
  ref_type?: string | null;
  ref_id?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  block_number?: number | null;
  gas_used?: string | null;
  created_at: string;
  confirmed_at?: string | null;
}

// Custody types (DESK trades)
export type {
  CustodyAsset,
  CustodyAssetPublic,
  CustodyLeg,
  CustodyLegStatus,
  CustodyPayout,
  CustodyPayoutStatus,
  DepositInstruction,
} from './custody/types';
