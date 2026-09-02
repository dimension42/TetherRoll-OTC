/**
 * Custody types (Desk trade entities). See docs/CUSTODY_SPEC.md.
 */

export interface CustodyAsset {
  id: string;
  chain_key: string;
  chain_name: string;
  symbol: string;
  name: string;
  decimals: number;
  kind: 'native' | 'token';
  token_id: string | null;
  deposit_address: string;
  address_regex: string | null;
  explorer_tx_url: string | null;
  explorer_address_url: string | null;
  verifier: 'bitcoin' | 'tron' | 'solana' | 'evm' | 'manual';
  verifier_config: Record<string, unknown>;
  min_confirmations: number;
  min_amount: string;
  max_amount: string | null;
  payout_2p_threshold: string | null;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Public projection (no deposit address or verifier config) */
export interface CustodyAssetPublic {
  id: string;
  chain_key: string;
  chain_name: string;
  symbol: string;
  name: string;
  decimals: number;
  kind: 'native' | 'token';
  token_id: string | null;
  explorer_tx_url: string | null;
  explorer_address_url: string | null;
  verifier: 'bitcoin' | 'tron' | 'solana' | 'evm' | 'manual';
  min_confirmations: number;
  min_amount: string;
  max_amount: string | null;
}

export type CustodyLegStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REFUNDED'
  | 'SENT'
  | 'RECEIVED';

export interface CustodyLeg {
  id: string;
  trade_id: string;
  side: 'OFFER' | 'REQUEST';
  owner_id: string | null;
  counterparty_id: string | null;
  kind: 'CRYPTO' | 'FIAT';
  asset_id: string | null;
  fiat_currency: string | null;
  amount: string;
  amount_with_suffix: string | null;
  deposit_address: string | null;
  receive_address: string | null;
  refund_address: string | null;
  bank_info_enc: string | null;
  tx_hash: string | null;
  confirmations: number;
  status: CustodyLegStatus;
  verified_at: string | null;
  verified_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type CustodyPayoutStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'FAILED'
  | 'REJECTED';

export interface CustodyPayout {
  id: string;
  trade_id: string;
  leg_id: string | null;
  asset_id: string;
  to_address: string;
  amount: string;
  purpose: 'SETTLE' | 'REFUND';
  requested_by: string | null;
  approved_by: string | null;
  executed_by: string | null;
  tx_hash: string | null;
  status: CustodyPayoutStatus;
  needs_approval: boolean;
  verified_at: string | null;
  reject_reason: string | null;
  note: string | null;
  created_at: string;
  executed_at: string | null;
}

export interface DepositInstruction {
  depositAddress: string;
  exactAmount: string;
  exactAmountFormatted: string;
  qrString: string;
  assetSymbol: string;
  assetChain: string;
  minConfirmations: number;
  explorerUrl: string | null;
}
