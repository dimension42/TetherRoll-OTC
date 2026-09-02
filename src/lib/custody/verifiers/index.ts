import type { CustodyAsset } from '../types';

export interface VerifyTxResult {
  found: boolean;
  toMatches: boolean;
  amount: bigint | null;
  confirmations: number;
  ok: boolean;
  raw?: unknown;
}

export interface ScannedTx {
  txHash: string;
  amount: bigint;
  confirmations: number;
}

export interface DepositVerifier {
  key: 'bitcoin' | 'tron' | 'solana' | 'evm' | 'manual';
  verifyTx(input: {
    asset: CustodyAsset;
    txHash: string;
    toAddress: string;
    expectedAmount: bigint;
  }): Promise<VerifyTxResult>;
  scanAddress?(asset: CustodyAsset, address: string, since?: string): Promise<ScannedTx[]>;
  validateAddress(asset: CustodyAsset, address: string): boolean;
}

export { bitcoinVerifier } from './bitcoin';
export { tronVerifier } from './tron';
export { solanaVerifier } from './solana';
export { evmVerifier } from './evm';
export { manualVerifier } from './manual';

import { bitcoinVerifier } from './bitcoin';
import { tronVerifier } from './tron';
import { solanaVerifier } from './solana';
import { evmVerifier } from './evm';
import { manualVerifier } from './manual';

export function getVerifier(key: string): DepositVerifier {
  switch (key) {
    case 'bitcoin':
      return bitcoinVerifier;
    case 'tron':
      return tronVerifier;
    case 'solana':
      return solanaVerifier;
    case 'evm':
      return evmVerifier;
    case 'manual':
      return manualVerifier;
    default:
      return manualVerifier;
  }
}
