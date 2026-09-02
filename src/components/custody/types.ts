/**
 * Custody-specific types (DESK trades, legs, payouts)
 * Mirrors CUSTODY_SPEC.md §3 — to be merged into src/lib/types.ts by backend agent
 */

export type DeskPoolKind = 'DESK';
export type DeskTradeKind = 'DESK';
export type LegSide = 'OFFER' | 'REQUEST';
export type LegKind = 'CRYPTO' | 'FIAT';
export type LegStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED' | 'SENT' | 'RECEIVED';
export type PayoutStatus = 'REQUESTED' | 'APPROVED' | 'EXECUTED' | 'VERIFIED' | 'FAILED' | 'REJECTED';
export type PayoutPurpose = 'SETTLE' | 'REFUND';

export type DeskTradeStatus =
  | 'PENDING'
  | 'AWAITING_DEPOSITS'
  | 'DEPOSITED'
  | 'PAYOUT_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'EXPIRED';

export interface CustodyAsset {
  id: string;
  chain_key: string;
  chain_name: string;
  symbol: string;
  name: string;
  decimals: number;
  kind: 'native' | 'token';
  token_id?: string | null;
  explorer_tx_url: string;
  explorer_address_url?: string | null;
  address_regex?: string | null;
  min_confirmations: number;
  min_amount: string;
  max_amount: string;
}

export interface CustodyLeg {
  id: string;
  trade_id: string;
  side: LegSide;
  kind: LegKind;
  owner_id: string;
  counterparty_id: string;
  asset?: {
    symbol: string;
    chain_name: string;
    decimals: number;
    explorer_tx_url: string;
  } | null;
  fiat_currency?: string | null;
  amount: string;
  amount_with_suffix?: string | null;
  deposit_address?: string | null;
  receive_address?: string | null;
  tx_hash?: string | null;
  confirmations?: number;
  min_confirmations?: number;
  status: LegStatus;
  note?: string | null;
  instructions?: {
    depositAddress: string;
    exactAmount: string;
    exactAmountFormatted: string;
    qr: string;
  } | null;
  bankInfo?: {
    bank: string;
    account: string;
    holder: string;
  } | null;
  created_at: string;
  updated_at?: string;
}

export interface CustodyPayout {
  id: string;
  leg_id: string;
  to_address: string;
  amount: string;
  purpose: PayoutPurpose;
  status: PayoutStatus;
  tx_hash?: string | null;
  explorer_url?: string | null;
  created_at: string;
  executed_at?: string | null;
}

export interface DeskTrade {
  id: string;
  pool_id?: string | null;
  kind: DeskTradeKind;
  status: DeskTradeStatus;
  deadline?: string | null;
  created_at: string;
  updated_at?: string;
  // Populated by GET /api/trades/[id]
  legs?: CustodyLeg[];
  payouts?: CustodyPayout[];
}

export interface DeskPool {
  id: string;
  kind: DeskPoolKind;
  visibility: 'public' | 'vip';
  creator_id: string | null;
  offer_asset_id?: string | null;
  request_asset_id?: string | null;
  offer_symbol: string | null;
  request_symbol: string | null;
  offer_amount_wei: string | null;
  request_amount_wei: string | null;
  offer_decimals: number | null;
  request_decimals: number | null;
  fiat_currency?: string | null;
  trade_type: 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO' | null;
  status: 'OPEN' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'HIDDEN';
  expires_at: string | null;
  allow_partial: boolean;
  created_at: string;
  updated_at?: string;
}
