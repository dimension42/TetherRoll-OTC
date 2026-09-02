import type { DepositVerifier, VerifyTxResult } from './index';
import type { CustodyAsset } from '../types';
import { validateReceiveAddress } from '../address';

const TRONGRID_API_BASE = process.env.TRON_API_BASE || 'https://api.trongrid.io';
const TIMEOUT_MS = 8000;

interface TronTxInfo {
  ret?: Array<{ contractRet: string }>;
  blockNumber?: number;
}

interface TronTx {
  txID: string;
  raw_data: {
    contract: Array<{
      type: string;
      parameter: {
        value: {
          owner_address?: string;
          to_address?: string;
          amount?: number;
          data?: string;
          contract_address?: string;
        };
      };
    }>;
  };
}

interface TronNowBlock {
  block_header: { raw_data: { number: number } };
}

interface TronEvent {
  transaction_id: string;
  event_name: string;
  result: { to?: string; value?: string };
  block_number: number;
}

function _hexToBase58(hex: string): string {
  // Simplified Tron address conversion (TronGrid returns base58 in most APIs)
  // For production, use a proper library like tronweb
  return hex; // Placeholder — in real code, use proper conversion
}

export const tronVerifier: DepositVerifier = {
  key: 'tron',

  validateAddress(asset: CustodyAsset, address: string): boolean {
    return validateReceiveAddress(asset, address);
  },

  async verifyTx(input): Promise<VerifyTxResult> {
    const { asset, txHash, toAddress, expectedAmount } = input;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers: Record<string, string> = {};
    if (process.env.TRONGRID_API_KEY) {
      headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
    }

    try {
      // Native TRX transfer
      if (asset.kind === 'native') {
        const txRes = await fetch(`${TRONGRID_API_BASE}/wallet/gettransactionbyid`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: txHash }),
          signal: controller.signal,
        });

        if (!txRes.ok) {
          return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
        }

        const tx = (await txRes.json()) as TronTx;
        const contract = tx.raw_data?.contract?.[0];
        if (!contract || contract.type !== 'TransferContract') {
          return { found: true, toMatches: false, amount: null, confirmations: 0, ok: false, raw: tx };
        }

        const to = contract.parameter.value.to_address;
        const amount = BigInt(contract.parameter.value.amount || 0);
        const toMatches = to === toAddress;

        // Get confirmation count
        const infoRes = await fetch(`${TRONGRID_API_BASE}/wallet/gettransactioninfobyid`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: txHash }),
          signal: controller.signal,
        });

        let confirmations = 0;
        if (infoRes.ok) {
          const info = (await infoRes.json()) as TronTxInfo;
          if (info.blockNumber) {
            const nowRes = await fetch(`${TRONGRID_API_BASE}/wallet/getnowblock`, {
              headers,
              signal: controller.signal,
            });
            if (nowRes.ok) {
              const nowBlock = (await nowRes.json()) as TronNowBlock;
              const currentHeight = nowBlock.block_header.raw_data.number;
              confirmations = currentHeight - info.blockNumber + 1;
            }
          }
        }

        const ok = toMatches && amount >= expectedAmount && confirmations >= asset.min_confirmations;
        return { found: true, toMatches, amount, confirmations, ok, raw: tx };
      }

      // TRC-20 token transfer
      if (asset.kind === 'token' && asset.token_id) {
        const eventsRes = await fetch(`${TRONGRID_API_BASE}/v1/transactions/${txHash}/events`, {
          headers,
          signal: controller.signal,
        });

        if (!eventsRes.ok) {
          return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
        }

        const eventsData = (await eventsRes.json()) as { data?: TronEvent[] };
        const transferEvent = eventsData.data?.find(
          e => e.event_name === 'Transfer' && e.result.to === toAddress,
        );

        if (!transferEvent) {
          return { found: true, toMatches: false, amount: null, confirmations: 0, ok: false, raw: eventsData };
        }

        const amount = BigInt(transferEvent.result.value || '0');
        const toMatches = true;

        // Confirmations
        const nowRes = await fetch(`${TRONGRID_API_BASE}/wallet/getnowblock`, {
          headers,
          signal: controller.signal,
        });
        let confirmations = 0;
        if (nowRes.ok) {
          const nowBlock = (await nowRes.json()) as TronNowBlock;
          const currentHeight = nowBlock.block_header.raw_data.number;
          confirmations = currentHeight - transferEvent.block_number + 1;
        }

        const ok = toMatches && amount >= expectedAmount && confirmations >= asset.min_confirmations;
        return { found: true, toMatches, amount, confirmations, ok, raw: eventsData };
      }

      return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
    } catch (error) {
      console.error('[tron-verifier] Error:', error);
      return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  // No scanAddress for Tron (TRC-20 account history requires pagination, complex)
};
