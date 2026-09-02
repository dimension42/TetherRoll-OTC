import type { DepositVerifier, VerifyTxResult, ScannedTx } from './index';
import type { CustodyAsset } from '../types';
import { validateReceiveAddress } from '../address';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TIMEOUT_MS = 8000;

interface SolanaRpcResult<T> {
  jsonrpc: string;
  id: number;
  result: T | null;
  error?: { message: string };
}

interface ParsedInstruction {
  parsed: {
    type: string;
    info: {
      destination?: string;
      lamports?: number;
      amount?: string;
      authority?: string;
    };
  };
  program: string;
  programId: string;
}

interface SolanaTransaction {
  slot: number;
  transaction: {
    message: {
      instructions: ParsedInstruction[];
    };
  };
  meta: {
    err: unknown;
  };
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = (await res.json()) as SolanaRpcResult<T>;
    if (data.error) {
      console.error('[solana-rpc]', data.error.message);
      return null;
    }
    return data.result;
  } catch (error) {
    console.error('[solana-rpc] Error:', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const solanaVerifier: DepositVerifier = {
  key: 'solana',

  validateAddress(asset: CustodyAsset, address: string): boolean {
    return validateReceiveAddress(asset, address);
  },

  async verifyTx(input): Promise<VerifyTxResult> {
    const { asset, txHash, toAddress, expectedAmount } = input;

    try {
      const tx = await rpcCall<SolanaTransaction>('getTransaction', [
        txHash,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
      ]);

      if (!tx || tx.meta?.err) {
        return { found: !!tx, toMatches: false, amount: null, confirmations: 0, ok: false, raw: tx };
      }

      const instructions = tx.transaction.message.instructions;
      let amount: bigint | null = null;
      let toMatches = false;

      // Native SOL transfer
      if (asset.kind === 'native') {
        const transferIx = instructions.find(
          ix => ix.program === 'system' && ix.parsed?.type === 'transfer' && ix.parsed.info.destination === toAddress,
        );
        if (transferIx) {
          amount = BigInt(transferIx.parsed.info.lamports || 0);
          toMatches = true;
        }
      }

      // SPL token transfer
      if (asset.kind === 'token' && asset.token_id) {
        // Find transfer or transferChecked instruction to the deposit address owner's ATA
        // For simplicity, we check if the destination matches (platform should configure deposit_address as token account or owner)
        const splTransfer = instructions.find(
          ix =>
            (ix.program === 'spl-token' || ix.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') &&
            (ix.parsed?.type === 'transfer' || ix.parsed?.type === 'transferChecked') &&
            ix.parsed.info.destination === toAddress,
        );
        if (splTransfer) {
          amount = BigInt(splTransfer.parsed.info.amount || '0');
          toMatches = true;
        }
      }

      // Confirmations: finalized = confirmed, get current slot
      const currentSlot = await rpcCall<number>('getSlot', ['finalized']);
      const confirmations = currentSlot && tx.slot ? currentSlot - tx.slot : 0;

      const ok = toMatches && amount !== null && amount >= expectedAmount && confirmations >= asset.min_confirmations;
      return { found: true, toMatches, amount, confirmations, ok, raw: tx };
    } catch (error) {
      console.error('[solana-verifier] Error:', error);
      return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
    }
  },

  async scanAddress(asset: CustodyAsset, address: string): Promise<ScannedTx[]> {
    try {
      // Get recent signatures for the address
      const sigs = await rpcCall<Array<{ signature: string; slot: number }>>('getSignaturesForAddress', [
        address,
        { limit: 20 },
      ]);
      if (!sigs) return [];

      const results: ScannedTx[] = [];
      const currentSlot = (await rpcCall<number>('getSlot', ['finalized'])) ?? 0;

      for (const sig of sigs) {
        const tx = await rpcCall<SolanaTransaction>('getTransaction', [
          sig.signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
        ]);
        if (!tx || tx.meta?.err) continue;

        const instructions = tx.transaction.message.instructions;
        let amount: bigint | null = null;

        if (asset.kind === 'native') {
          const transferIx = instructions.find(
            ix =>
              ix.program === 'system' && ix.parsed?.type === 'transfer' && ix.parsed.info.destination === address,
          );
          if (transferIx) {
            amount = BigInt(transferIx.parsed.info.lamports || 0);
          }
        }

        if (asset.kind === 'token') {
          const splTransfer = instructions.find(
            ix =>
              (ix.program === 'spl-token' || ix.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') &&
              (ix.parsed?.type === 'transfer' || ix.parsed?.type === 'transferChecked') &&
              ix.parsed.info.destination === address,
          );
          if (splTransfer) {
            amount = BigInt(splTransfer.parsed.info.amount || '0');
          }
        }

        if (amount && amount > BigInt(0)) {
          results.push({
            txHash: sig.signature,
            amount,
            confirmations: currentSlot - sig.slot,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[solana-verifier] Scan error:', error);
      return [];
    }
  },
};
