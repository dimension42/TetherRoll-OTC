import { db } from '@/lib/db';

/**
 * Add a random suffix to an amount to make it unique among open legs for the asset.
 * Replaces the last 3-4 minor digits with a non-zero random code.
 * Retries if the resulting amount collides with an existing leg.
 */
export async function amountWithSuffix(
  amount: bigint,
  decimals: number,
  assetId: string,
): Promise<bigint> {
  const digits = Number(process.env.CUSTODY_SUFFIX_DIGITS || '3');
  if (digits < 2 || digits > 6) {
    throw new Error('CUSTODY_SUFFIX_DIGITS must be 2-6');
  }

  const divisor = BigInt(10) ** BigInt(digits);
  const base = (amount / divisor) * divisor;

  // Safety: if amount is too small to add suffix, just return as-is
  if (amount < divisor) {
    return amount;
  }

  const maxAttempts = 50;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random suffix: 1 to (divisor - 1)
    const suffix = BigInt(Math.floor(Math.random() * Number(divisor - BigInt(1))) + 1);
    const candidate = base + suffix;

    // Check uniqueness among PENDING/SUBMITTED/CONFIRMING legs for this asset
    const { data } = await db()
      .from('custody_legs')
      .select('id')
      .eq('asset_id', assetId)
      .eq('amount_with_suffix', candidate.toString())
      .in('status', ['PENDING', 'SUBMITTED', 'CONFIRMING'])
      .maybeSingle();

    if (!data) {
      // No collision, use this amount
      return candidate;
    }

    // Collision detected, retry
  }

  // If we exhausted retries, throw error (extremely unlikely with 3+ digits)
  throw new Error('Failed to generate unique amount suffix after 50 attempts');
}
