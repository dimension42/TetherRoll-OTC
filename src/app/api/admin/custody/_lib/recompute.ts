/**
 * Trade state recomputation for custody desk trades.
 * Called after leg confirmation to auto-advance trade status and create payouts.
 */

import { db } from '@/lib/db';

/**
 * Recompute trade status after a leg is confirmed.
 * SPEC §2: DEPOSITED when all CRYPTO legs CONFIRMED + all FIAT legs RECEIVED.
 * Then auto-create SETTLE payouts.
 */
export async function recomputeTradeAfterLegConfirm(tradeId: string): Promise<void> {
  const { data: trade } = await db().from('trades').select('*').eq('id', tradeId).single();
  if (!trade || trade.kind !== 'DESK') return;

  const { data: legs } = await db().from('custody_legs').select('*').eq('trade_id', tradeId);
  if (!legs || legs.length === 0) return;

  // Check if all legs are ready
  const allCryptoConfirmed = legs
    .filter(l => l.kind === 'CRYPTO')
    .every(l => l.status === 'CONFIRMED');
  const allFiatReceived = legs
    .filter(l => l.kind === 'FIAT')
    .every(l => l.status === 'RECEIVED');

  if (allCryptoConfirmed && allFiatReceived && trade.status !== 'DEPOSITED') {
    // Advance to DEPOSITED
    await db().from('trades').update({ status: 'DEPOSITED', updated_at: new Date().toISOString() }).eq('id', tradeId);

    // Create SETTLE payouts for each leg's counterparty
    for (const leg of legs) {
      if (leg.kind === 'CRYPTO' && leg.asset_id && leg.receive_address) {
        // Counterparty receives crypto at their receive_address
        const { data: asset } = await db().from('custody_assets').select('*').eq('id', leg.asset_id).single();
        if (!asset) continue;

        const needsApproval = asset.payout_2p_threshold
          ? BigInt(leg.amount) >= BigInt(asset.payout_2p_threshold)
          : true;

        await db().from('custody_payouts').insert({
          trade_id: tradeId,
          leg_id: leg.id,
          asset_id: leg.asset_id,
          to_address: leg.receive_address,
          amount: leg.amount,
          purpose: 'SETTLE',
          requested_by: null, // System auto-generated
          needs_approval: needsApproval,
          status: 'REQUESTED',
        });
      }
      // FIAT legs are handled off-platform (bank transfer), no payout row
    }

    // Advance trade to PAYOUT_PENDING
    await db().from('trades').update({ status: 'PAYOUT_PENDING', updated_at: new Date().toISOString() }).eq('id', tradeId);
  }
}

/**
 * Check if all payouts of a trade are EXECUTED/VERIFIED.
 * If so, mark trade as COMPLETED (for SETTLE purpose) or REFUNDED (for REFUND purpose).
 */
export async function recomputeTradeAfterPayoutExecuted(tradeId: string): Promise<void> {
  const { data: payouts } = await db().from('custody_payouts').select('*').eq('trade_id', tradeId);
  if (!payouts || payouts.length === 0) return;

  const allDone = payouts.every(p => p.status === 'EXECUTED' || p.status === 'VERIFIED');
  if (!allDone) return;

  const { data: trade } = await db().from('trades').select('*').eq('id', tradeId).single();
  if (!trade) return;

  // Determine final status based on purpose
  const isRefund = payouts.some(p => p.purpose === 'REFUND');
  const finalStatus = isRefund ? 'REFUNDED' : 'COMPLETED';

  if (trade.status !== finalStatus) {
    await db().from('trades').update({ status: finalStatus, updated_at: new Date().toISOString() }).eq('id', tradeId);
  }
}
