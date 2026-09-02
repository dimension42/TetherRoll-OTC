import type { DepositVerifier, VerifyTxResult } from './index';
import type { CustodyAsset } from '../types';
import { validateReceiveAddress } from '../address';

/**
 * Manual verifier — always returns found: false.
 * Admin must manually confirm deposits for assets using this verifier.
 */
export const manualVerifier: DepositVerifier = {
  key: 'manual',

  validateAddress(asset: CustodyAsset, address: string): boolean {
    return validateReceiveAddress(asset, address);
  },

  async verifyTx(): Promise<VerifyTxResult> {
    return {
      found: false,
      toMatches: false,
      amount: null,
      confirmations: 0,
      ok: false,
    };
  },
};
