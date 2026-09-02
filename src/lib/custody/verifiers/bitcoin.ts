import type { DepositVerifier, VerifyTxResult, ScannedTx } from './index';
import type { CustodyAsset } from '../types';
import { validateReceiveAddress } from '../address';

const MEMPOOL_API_BASE = process.env.MEMPOOL_API_BASE || 'https://mempool.space/api';
const TIMEOUT_MS = 8000;

interface MempoolTx {
  txid: string;
  status: { confirmed: boolean; block_height?: number };
  vout: Array<{ scriptpubkey_address?: string; value: number }>;
}

interface _MempoolTip {
  height: number;
}

export const bitcoinVerifier: DepositVerifier = {
  key: 'bitcoin',

  validateAddress(asset: CustodyAsset, address: string): boolean {
    return validateReceiveAddress(asset, address);
  },

  async verifyTx(input): Promise<VerifyTxResult> {
    const { txHash, toAddress, expectedAmount } = input;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Fetch transaction
      const txRes = await fetch(`${MEMPOOL_API_BASE}/tx/${txHash}`, {
        signal: controller.signal,
      });
      if (!txRes.ok) {
        return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
      }
      const tx = (await txRes.json()) as MempoolTx;

      // Find output to the expected address
      const vout = tx.vout.find(o => o.scriptpubkey_address === toAddress);
      if (!vout) {
        return {
          found: true,
          toMatches: false,
          amount: null,
          confirmations: 0,
          ok: false,
          raw: tx,
        };
      }

      const amount = BigInt(vout.value); // satoshis
      const toMatches = true;

      // Calculate confirmations
      let confirmations = 0;
      if (tx.status.confirmed && tx.status.block_height) {
        const tipRes = await fetch(`${MEMPOOL_API_BASE}/blocks/tip/height`, {
          signal: controller.signal,
        });
        if (tipRes.ok) {
          const tipHeight = Number(await tipRes.text());
          confirmations = tipHeight - tx.status.block_height + 1;
        }
      }

      const ok = toMatches && amount >= expectedAmount && confirmations >= input.asset.min_confirmations;

      return { found: true, toMatches, amount, confirmations, ok, raw: tx };
    } catch (error) {
      console.error('[bitcoin-verifier] Error:', error);
      return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async scanAddress(asset: CustodyAsset, address: string): Promise<ScannedTx[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${MEMPOOL_API_BASE}/address/${address}/txs`, {
        signal: controller.signal,
      });
      if (!res.ok) return [];

      const txs = (await res.json()) as MempoolTx[];
      const results: ScannedTx[] = [];

      // Get current tip height for confirmations
      const tipRes = await fetch(`${MEMPOOL_API_BASE}/blocks/tip/height`, {
        signal: controller.signal,
      });
      const tipHeight = tipRes.ok ? Number(await tipRes.text()) : 0;

      for (const tx of txs.slice(0, 20)) {
        // Last 20 txs
        const vout = tx.vout.find(o => o.scriptpubkey_address === address);
        if (vout && vout.value > 0) {
          const confirmations =
            tx.status.confirmed && tx.status.block_height ? tipHeight - tx.status.block_height + 1 : 0;
          results.push({
            txHash: tx.txid,
            amount: BigInt(vout.value),
            confirmations,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[bitcoin-verifier] Scan error:', error);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
