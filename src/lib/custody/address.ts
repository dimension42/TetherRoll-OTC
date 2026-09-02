import { isAddress } from 'viem';
import type { CustodyAsset } from './types';

/**
 * Validate a user's receive address for a custody asset.
 * Uses asset.address_regex if set, otherwise chain-specific defaults.
 */
export function validateReceiveAddress(asset: CustodyAsset, address: string): boolean {
  if (!address || address.length === 0) return false;

  // Use asset-specific regex if provided
  if (asset.address_regex) {
    try {
      const regex = new RegExp(asset.address_regex);
      return regex.test(address);
    } catch {
      // Invalid regex in DB, fall back to chain defaults
    }
  }

  // Chain-specific defaults
  const chain = asset.chain_key.toUpperCase();

  switch (chain) {
    case 'BTC':
    case 'BITCOIN':
      // P2WPKH (bc1), P2PKH (1), P2SH (3)
      return /^(bc1[0-9a-z]{25,90}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(address);

    case 'LTC':
    case 'LITECOIN':
      // Litecoin: ltc1 (bech32), L (P2PKH), M or 3 (P2SH)
      return /^(ltc1[0-9a-z]{25,90}|[LM3][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(address);

    case 'TRON':
    case 'TRC20':
      // Tron addresses start with T and are 34 chars base58
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);

    case 'SOLANA':
    case 'SOL':
    case 'SPL':
      // Base58 encoded, typically 32-44 chars
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

    case 'ETHEREUM':
    case 'ETH':
    case 'POLYGON':
    case 'POL':
    case 'BSC':
    case 'BNB':
    case 'ERC20':
    case 'EVM':
      // EVM addresses (0x + 40 hex)
      return isAddress(address);

    default:
      // Unknown chain — accept if looks like a reasonable address (alphanumeric 20-90 chars)
      return /^[0-9A-Za-z]{20,90}$/.test(address);
  }
}
