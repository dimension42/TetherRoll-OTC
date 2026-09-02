/**
 * Formatting utilities for custody amounts and addresses.
 */

/** Format minor-unit amount to human-readable decimal string */
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;

  if (frac === BigInt(0)) {
    return whole.toString();
  }

  const fracStr = frac.toString().padStart(decimals, '0');
  // Trim trailing zeros
  const trimmed = fracStr.replace(/0+$/, '');
  return `${whole}.${trimmed}`;
}

/** Generate QR string for deposit instruction */
export function generateQrString(
  chainKey: string,
  address: string,
  amount: string,
  decimals: number,
): string {
  const chain = chainKey.toUpperCase();

  switch (chain) {
    case 'BTC':
    case 'BITCOIN':
      // BIP21: bitcoin:<address>?amount=<btc>
      return `bitcoin:${address}?amount=${formatAmount(BigInt(amount), decimals)}`;

    case 'LTC':
    case 'LITECOIN':
      return `litecoin:${address}?amount=${formatAmount(BigInt(amount), decimals)}`;

    case 'SOLANA':
    case 'SOL':
    case 'SPL':
      // Solana: solana:<address>?amount=<sol>&spl-token=<mint>
      return `solana:${address}?amount=${formatAmount(BigInt(amount), decimals)}`;

    case 'TRON':
    case 'TRC20':
      // No standard URI scheme for Tron, just return the address
      return address;

    default:
      // Generic fallback: just the address
      return address;
  }
}
