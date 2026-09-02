import { createPublicClient, http, type PublicClient, decodeEventLog, parseAbiItem } from 'viem';
import type { DepositVerifier, VerifyTxResult } from './index';
import type { CustodyAsset } from '../types';
import { validateReceiveAddress } from '../address';
import { chainById } from '@/lib/chains';

const TIMEOUT_MS = 8000;

// ERC-20 Transfer event ABI
const TRANSFER_EVENT_ABI = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

function getClient(chainId: number): PublicClient | null {
  const chain = chainById(chainId);
  if (!chain) return null;
  return createPublicClient({ chain, transport: http(undefined, { timeout: TIMEOUT_MS }) });
}

export const evmVerifier: DepositVerifier = {
  key: 'evm',

  validateAddress(asset: CustodyAsset, address: string): boolean {
    return validateReceiveAddress(asset, address);
  },

  async verifyTx(input): Promise<VerifyTxResult> {
    const { asset, txHash, toAddress, expectedAmount } = input;

    try {
      const chainId = (asset.verifier_config.chainId as number) ?? 1;
      const client = getClient(chainId);
      if (!client) {
        console.error('[evm-verifier] Unsupported chainId:', chainId);
        return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
      }

      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (!receipt) {
        return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
      }

      const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
      if (!tx) {
        return { found: true, toMatches: false, amount: null, confirmations: 0, ok: false, raw: receipt };
      }

      let amount: bigint | null = null;
      let toMatches = false;

      // Native transfer (ETH, BNB, POL)
      if (asset.kind === 'native') {
        if (tx.to?.toLowerCase() === toAddress.toLowerCase()) {
          amount = tx.value;
          toMatches = true;
        }
      }

      // ERC-20 transfer
      if (asset.kind === 'token' && asset.token_id) {
        const tokenAddress = (asset.verifier_config.tokenAddress as string) ?? asset.token_id;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;

          try {
            const decoded = decodeEventLog({
              abi: [TRANSFER_EVENT_ABI],
              data: log.data,
              topics: log.topics,
            });

            if (decoded.eventName === 'Transfer') {
              const args = decoded.args as { to: string; value: bigint };
              if (args.to.toLowerCase() === toAddress.toLowerCase()) {
                amount = args.value;
                toMatches = true;
                break;
              }
            }
          } catch {
            // Not a Transfer event or parsing failed, skip
          }
        }
      }

      // Confirmations
      const currentBlock = await client.getBlockNumber();
      const confirmations = receipt.blockNumber ? Number(currentBlock - receipt.blockNumber) + 1 : 0;

      const ok = toMatches && amount !== null && amount >= expectedAmount && confirmations >= asset.min_confirmations;
      return { found: true, toMatches, amount, confirmations, ok, raw: { receipt, tx } };
    } catch (error) {
      console.error('[evm-verifier] Error:', error);
      return { found: false, toMatches: false, amount: null, confirmations: 0, ok: false };
    }
  },

  // No scanAddress for EVM (would require archive node queries or external indexer)
};
