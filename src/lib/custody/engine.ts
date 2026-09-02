import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth/guards';
import { getAsset } from './assets';
import { validateReceiveAddress } from './address';
import { amountWithSuffix } from './suffix';
import { getVerifier } from './verifiers';
import type { BankInfo } from '@/lib/types';
import type { CustodyLeg, CustodyPayout } from './types';

interface CreateDeskTradeInput {
  pool: {
    id: string;
    kind: string;
    trade_type: string;
    creator_id: string;
    chain_id: number;
    offer_asset_id?: string | null;
    request_asset_id?: string | null;
    fiat_currency?: string | null;
    offer_amount_wei?: string | null;
    request_amount_wei?: string | null;
    allow_partial: boolean;
    deadline?: string | null;
    maker_receive_address?: string | null;
    maker_refund_address?: string | null;
    maker_bank_info_enc?: string | null;
  };
  taker: { id: string };
  amount?: string; // Partial fill amount (minor units)
  receiveAddress?: string; // Taker's receive address for crypto
  refundAddress?: string; // Taker's refund address for crypto
  bankInfo?: BankInfo; // Taker's bank info if receiving KRW
}

/**
 * Create a DESK trade from a pool.
 * Builds 2 legs: offer (pool creator) and request (taker).
 */
export async function createDeskTrade(input: CreateDeskTradeInput): Promise<string> {
  const { pool, taker, amount, receiveAddress, refundAddress } = input;

  if (pool.kind !== 'DESK') {
    throw new AuthError(400, 'Pool is not a DESK pool');
  }

  // Determine trade amounts (full or partial)
  const isSell = pool.trade_type === 'CRYPTO_FIAT';
  const isBuy = pool.trade_type === 'FIAT_CRYPTO';
  const _isCryptoCrypto = pool.trade_type === 'CRYPTO_CRYPTO';

  let offerAmount = BigInt(pool.offer_amount_wei || '0');
  let requestAmount = BigInt(pool.request_amount_wei || '0');

  if (amount && pool.allow_partial) {
    const partialAmount = BigInt(amount);
    // Pro-rata adjustment
    const ratio = (partialAmount * BigInt(10000)) / offerAmount;
    offerAmount = partialAmount;
    requestAmount = (requestAmount * ratio) / BigInt(10000);
  }

  // Create trade
  const { data: trade, error: tradeErr } = await db()
    .from('trades')
    .insert({
      pool_id: pool.id,
      kind: 'DESK',
      chain_id: pool.chain_id,
      maker_id: pool.creator_id,
      taker_id: taker.id,
      status: 'PENDING',
      deadline: pool.deadline || null,
    })
    .select('id')
    .single();

  if (tradeErr || !trade) throw tradeErr || new Error('Failed to create trade');
  const tradeId = trade.id;

  // Build legs
  const legs: Array<{
    trade_id: string;
    side: 'OFFER' | 'REQUEST';
    owner_id: string;
    counterparty_id: string;
    kind: 'CRYPTO' | 'FIAT';
    asset_id?: string | null;
    fiat_currency?: string | null;
    amount: string;
    amount_with_suffix?: string | null;
    deposit_address?: string | null;
    receive_address?: string | null;
    refund_address?: string | null;
    bank_info_enc?: string | null;
    status: string;
  }> = [];

  // Offer leg (maker offers)
  if (pool.offer_asset_id) {
    // Crypto offer: maker deposits crypto → taker receives
    const asset = await getAsset(pool.offer_asset_id);
    if (!asset) throw new AuthError(400, 'Offer asset not found');
    if (!asset.enabled) throw new AuthError(400, 'Offer asset is disabled');

    // Taker's receive address for this leg's payout
    if (!receiveAddress) throw new AuthError(400, 'receiveAddress required for receiving crypto offer');
    if (!validateReceiveAddress(asset, receiveAddress)) throw new AuthError(400, 'Invalid receiveAddress');

    // Maker's refund address (from pool)
    if (!pool.maker_refund_address) throw new AuthError(400, 'Pool missing maker_refund_address');
    if (!validateReceiveAddress(asset, pool.maker_refund_address)) {
      throw new AuthError(500, 'Invalid pool maker_refund_address');
    }

    const suffix = await amountWithSuffix(offerAmount, asset.decimals, asset.id);

    legs.push({
      trade_id: tradeId,
      side: 'OFFER',
      owner_id: pool.creator_id,
      counterparty_id: taker.id,
      kind: 'CRYPTO',
      asset_id: asset.id,
      amount: offerAmount.toString(),
      amount_with_suffix: suffix.toString(),
      deposit_address: asset.deposit_address,
      receive_address: receiveAddress,
      refund_address: pool.maker_refund_address,
      status: 'PENDING',
    });
  } else if (pool.fiat_currency && isBuy) {
    // Fiat offer (FIAT_CRYPTO: maker offers KRW)
    // Taker sends KRW to maker, so bank_info is maker's (receiver)
    if (!pool.maker_bank_info_enc) throw new AuthError(400, 'Pool missing maker bank info');
    legs.push({
      trade_id: tradeId,
      side: 'OFFER',
      owner_id: taker.id, // Taker sends KRW
      counterparty_id: pool.creator_id,
      kind: 'FIAT',
      fiat_currency: pool.fiat_currency,
      amount: offerAmount.toString(),
      bank_info_enc: pool.maker_bank_info_enc,
      status: 'PENDING',
    });
  }

  // Request leg (what maker requests)
  if (pool.request_asset_id) {
    // Crypto request: taker deposits crypto → maker receives
    const asset = await getAsset(pool.request_asset_id);
    if (!asset) throw new AuthError(400, 'Request asset not found');
    if (!asset.enabled) throw new AuthError(400, 'Request asset is disabled');

    // Maker's receive address (from pool)
    if (!pool.maker_receive_address) throw new AuthError(400, 'Pool missing maker_receive_address');
    if (!validateReceiveAddress(asset, pool.maker_receive_address)) {
      throw new AuthError(500, 'Invalid pool maker_receive_address');
    }

    // Taker's refund address
    if (!refundAddress) throw new AuthError(400, 'refundAddress required for depositing crypto');
    if (!validateReceiveAddress(asset, refundAddress)) throw new AuthError(400, 'Invalid refundAddress');

    const suffix = await amountWithSuffix(requestAmount, asset.decimals, asset.id);

    legs.push({
      trade_id: tradeId,
      side: 'REQUEST',
      owner_id: taker.id,
      counterparty_id: pool.creator_id,
      kind: 'CRYPTO',
      asset_id: asset.id,
      amount: requestAmount.toString(),
      amount_with_suffix: suffix.toString(),
      deposit_address: asset.deposit_address,
      receive_address: pool.maker_receive_address,
      refund_address: refundAddress,
      status: 'PENDING',
    });
  } else if (pool.fiat_currency && isSell) {
    // Fiat request (CRYPTO_FIAT: maker requests KRW)
    // Taker sends KRW to maker, so bank_info is maker's (receiver)
    if (!pool.maker_bank_info_enc) throw new AuthError(400, 'Pool missing maker bank info');
    legs.push({
      trade_id: tradeId,
      side: 'REQUEST',
      owner_id: taker.id, // Taker sends KRW
      counterparty_id: pool.creator_id,
      kind: 'FIAT',
      fiat_currency: pool.fiat_currency,
      amount: requestAmount.toString(),
      bank_info_enc: pool.maker_bank_info_enc,
      status: 'PENDING',
    });
  }

  if (legs.length !== 2) {
    throw new AuthError(500, 'Invalid pool configuration: expected 2 legs');
  }

  const { error: legsErr } = await db().from('custody_legs').insert(legs);
  if (legsErr) throw legsErr;

  await recomputeTradeStatus(tradeId);
  return tradeId;
}

/**
 * Submit a tx hash for a CRYPTO leg. Runs verifier and updates status.
 */
export async function submitLegTx(legId: string, txHash: string, userId: string): Promise<void> {
  const { data: leg, error } = await db().from('custody_legs').select('*').eq('id', legId).maybeSingle();
  if (error || !leg) throw new AuthError(404, 'Leg not found');
  if (leg.owner_id !== userId) throw new AuthError(403, 'Not your leg');
  if (leg.kind !== 'CRYPTO') throw new AuthError(400, 'Only CRYPTO legs can submit tx hash');
  if (leg.status !== 'PENDING') throw new AuthError(400, 'Leg is not in PENDING status');

  const asset = await getAsset(leg.asset_id!);
  if (!asset) throw new AuthError(500, 'Asset not found');

  const verifier = getVerifier(asset.verifier);
  const result = await verifier.verifyTx({
    asset,
    txHash,
    toAddress: leg.deposit_address!,
    expectedAmount: BigInt(leg.amount_with_suffix || leg.amount),
  });

  let newStatus: string = 'SUBMITTED';
  let note = leg.note;

  if (result.found && result.toMatches && result.amount !== null) {
    const expectedAmount = BigInt(leg.amount_with_suffix || leg.amount);
    if (result.amount < expectedAmount) {
      newStatus = 'CONFIRMING';
      note = 'amount mismatch (insufficient)';
    } else if (result.confirmations >= asset.min_confirmations) {
      newStatus = 'CONFIRMED';
    } else {
      newStatus = 'CONFIRMING';
    }
  } else if (result.found) {
    newStatus = 'CONFIRMING';
    note = result.toMatches ? 'waiting for confirmations' : 'address mismatch';
  }

  await db()
    .from('custody_legs')
    .update({
      tx_hash: txHash,
      confirmations: result.confirmations,
      status: newStatus,
      verified_at: newStatus === 'CONFIRMED' ? new Date().toISOString() : null,
      verified_by: newStatus === 'CONFIRMED' ? 'auto' : null,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', legId);

  await recomputeTradeStatus(leg.trade_id);
}

/** Mark a FIAT leg as sent (payer) */
export async function markFiatSent(legId: string, userId: string): Promise<void> {
  const { data: leg, error } = await db().from('custody_legs').select('*').eq('id', legId).maybeSingle();
  if (error || !leg) throw new AuthError(404, 'Leg not found');
  if (leg.owner_id !== userId) throw new AuthError(403, 'Not your leg');
  if (leg.kind !== 'FIAT') throw new AuthError(400, 'Only FIAT legs can be marked sent');
  if (leg.status !== 'PENDING') throw new AuthError(400, 'Leg is not PENDING');

  await db()
    .from('custody_legs')
    .update({ status: 'SENT', updated_at: new Date().toISOString() })
    .eq('id', legId);

  await recomputeTradeStatus(leg.trade_id);
}

/** Mark a FIAT leg as received (receiver) */
export async function markFiatReceived(legId: string, userId: string): Promise<void> {
  const { data: leg, error } = await db().from('custody_legs').select('*').eq('id', legId).maybeSingle();
  if (error || !leg) throw new AuthError(404, 'Leg not found');
  if (leg.counterparty_id !== userId) throw new AuthError(403, 'Not the receiver');
  if (leg.kind !== 'FIAT') throw new AuthError(400, 'Only FIAT legs can be marked received');
  if (leg.status !== 'SENT') throw new AuthError(400, 'Leg must be SENT first');

  await db()
    .from('custody_legs')
    .update({
      status: 'RECEIVED',
      verified_at: new Date().toISOString(),
      verified_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', legId);

  await recomputeTradeStatus(leg.trade_id);
}

/**
 * Recompute trade status based on leg statuses and create payouts when ready.
 */
export async function recomputeTradeStatus(tradeId: string): Promise<void> {
  const { data: legs } = await db().from('custody_legs').select('*').eq('trade_id', tradeId);
  if (!legs || legs.length === 0) return;

  const cryptoLegs = legs.filter((l: CustodyLeg) => l.kind === 'CRYPTO');
  const fiatLegs = legs.filter((l: CustodyLeg) => l.kind === 'FIAT');

  const allCryptoConfirmed = cryptoLegs.every((l: CustodyLeg) => l.status === 'CONFIRMED');
  const allFiatReceived = fiatLegs.every((l: CustodyLeg) => l.status === 'RECEIVED');
  const anyConfirmed = cryptoLegs.some((l: CustodyLeg) => l.status === 'CONFIRMED');

  let newStatus = 'AWAITING_DEPOSITS';

  if (allCryptoConfirmed && allFiatReceived) {
    // All deposits confirmed — create settlement payouts
    newStatus = 'DEPOSITED';

    // Check if payouts already exist
    const { data: existingPayouts } = await db()
      .from('custody_payouts')
      .select('id')
      .eq('trade_id', tradeId)
      .eq('purpose', 'SETTLE')
      .limit(1);

    if (!existingPayouts || existingPayouts.length === 0) {
      // Create payouts for each CRYPTO leg
      const payouts = [];
      for (const leg of cryptoLegs as CustodyLeg[]) {
        const assetData = await getAsset(leg.asset_id!);
        let needsApproval = true;
        if (assetData && assetData.payout_2p_threshold !== null) {
          needsApproval = BigInt(leg.amount) >= BigInt(assetData.payout_2p_threshold);
        }

        payouts.push({
          trade_id: tradeId,
          leg_id: leg.id,
          asset_id: leg.asset_id!,
          to_address: leg.receive_address!,
          amount: leg.amount,
          purpose: 'SETTLE' as const,
          requested_by: null,
          status: 'REQUESTED' as const,
          needs_approval: needsApproval,
        });
      }

      await db().from('custody_payouts').insert(payouts);
      newStatus = 'PAYOUT_PENDING';
    } else {
      // Payouts exist — check their status
      const { data: allPayouts } = await db().from('custody_payouts').select('*').eq('trade_id', tradeId);
      const allExecuted = allPayouts?.every(
        (p: CustodyPayout) => p.status === 'EXECUTED' || p.status === 'VERIFIED',
      );
      newStatus = allExecuted ? 'COMPLETED' : 'PAYOUT_PENDING';
    }
  } else if (anyConfirmed) {
    newStatus = 'AWAITING_DEPOSITS';
  } else {
    newStatus = 'PENDING';
  }

  await db().from('trades').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', tradeId);
}

/**
 * Cancel a DESK trade.
 * Before any confirmed leg: immediate CANCELLED.
 * After any confirmed leg: requires both parties to request cancellation.
 */
export async function cancelDeskTrade(tradeId: string, userId: string): Promise<void> {
  const { data: trade, error: tradeErr } = await db().from('trades').select('*').eq('id', tradeId).maybeSingle();
  if (tradeErr || !trade) throw new AuthError(404, 'Trade not found');
  if (trade.kind !== 'DESK') throw new AuthError(400, 'Not a DESK trade');
  if (trade.maker_id !== userId && trade.taker_id !== userId) throw new AuthError(403, 'Not a party to this trade');

  const { data: legs } = await db().from('custody_legs').select('*').eq('trade_id', tradeId);
  const anyConfirmed = legs?.some((l: CustodyLeg) => l.status === 'CONFIRMED');

  if (!anyConfirmed) {
    // Immediate cancel
    await db().from('trades').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', tradeId);
    return;
  }

  // Confirmed legs exist — require both parties
  const cancelRequests = (trade.cancel_requested_by as string[]) || [];
  if (!cancelRequests.includes(userId)) {
    cancelRequests.push(userId);
    await db()
      .from('trades')
      .update({ cancel_requested_by: cancelRequests, updated_at: new Date().toISOString() })
      .eq('id', tradeId);
  }

  if (cancelRequests.length >= 2) {
    // Both parties agreed — create REFUND payouts for confirmed CRYPTO legs
    await db().from('trades').update({ status: 'REFUNDING', updated_at: new Date().toISOString() }).eq('id', tradeId);

    const confirmedCryptoLegs = legs?.filter((l: CustodyLeg) => l.kind === 'CRYPTO' && l.status === 'CONFIRMED') || [];
    const refundPayouts = confirmedCryptoLegs.map((leg: CustodyLeg) => ({
      trade_id: tradeId,
      leg_id: leg.id,
      asset_id: leg.asset_id!,
      to_address: leg.refund_address || leg.receive_address!,
      amount: leg.amount,
      purpose: 'REFUND' as const,
      requested_by: null,
      status: 'REQUESTED' as const,
      needs_approval: false,
    }));

    if (refundPayouts.length > 0) {
      await db().from('custody_payouts').insert(refundPayouts);
    }
  }
}

/**
 * Expire DESK trades past deadline without full deposits.
 * Create REFUND payouts for confirmed legs.
 */
export async function expireDeskTrades(): Promise<number> {
  const now = new Date().toISOString();
  const { data: trades } = await db()
    .from('trades')
    .select('id')
    .eq('kind', 'DESK')
    .in('status', ['PENDING', 'AWAITING_DEPOSITS'])
    .lt('deadline', now)
    .not('deadline', 'is', null);

  if (!trades || trades.length === 0) return 0;

  for (const trade of trades) {
    const { data: legs } = await db().from('custody_legs').select('*').eq('trade_id', trade.id);
    const confirmedCryptoLegs = legs?.filter((l: CustodyLeg) => l.kind === 'CRYPTO' && l.status === 'CONFIRMED') || [];

    if (confirmedCryptoLegs.length > 0) {
      // Create refunds
      const refundPayouts = confirmedCryptoLegs.map((leg: CustodyLeg) => ({
        trade_id: trade.id,
        leg_id: leg.id,
        asset_id: leg.asset_id!,
        to_address: leg.refund_address || leg.receive_address!,
        amount: leg.amount,
        purpose: 'REFUND' as const,
        requested_by: null,
        status: 'REQUESTED' as const,
        needs_approval: false,
      }));
      await db().from('custody_payouts').insert(refundPayouts);
      await db().from('trades').update({ status: 'REFUNDING' }).eq('id', trade.id);
    } else {
      await db().from('trades').update({ status: 'EXPIRED' }).eq('id', trade.id);
    }
  }

  return trades.length;
}

/**
 * Refresh CONFIRMING/SUBMITTED legs — re-verify and auto-scan PENDING legs.
 */
export async function refreshConfirming(): Promise<number> {
  let updated = 0;

  // Re-verify CONFIRMING/SUBMITTED legs
  const { data: legs } = await db()
    .from('custody_legs')
    .select('*')
    .in('status', ['CONFIRMING', 'SUBMITTED'])
    .eq('kind', 'CRYPTO');

  if (legs) {
    for (const leg of legs as CustodyLeg[]) {
      if (!leg.tx_hash || !leg.asset_id) continue;
      const asset = await getAsset(leg.asset_id);
      if (!asset) continue;

      const verifier = getVerifier(asset.verifier);
      const result = await verifier.verifyTx({
        asset,
        txHash: leg.tx_hash,
        toAddress: leg.deposit_address!,
        expectedAmount: BigInt(leg.amount_with_suffix || leg.amount),
      });

      if (result.ok && result.confirmations >= asset.min_confirmations) {
        await db()
          .from('custody_legs')
          .update({
            status: 'CONFIRMED',
            confirmations: result.confirmations,
            verified_at: new Date().toISOString(),
            verified_by: 'auto',
            updated_at: new Date().toISOString(),
          })
          .eq('id', leg.id);
        await recomputeTradeStatus(leg.trade_id);
        updated++;
      } else if (result.found) {
        await db()
          .from('custody_legs')
          .update({
            confirmations: result.confirmations,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leg.id);
      }
    }
  }

  // Auto-scan PENDING crypto legs whose verifier supports scanAddress
  const { data: pendingLegs } = await db()
    .from('custody_legs')
    .select('*')
    .eq('status', 'PENDING')
    .eq('kind', 'CRYPTO');

  if (pendingLegs) {
    for (const leg of pendingLegs as CustodyLeg[]) {
      if (!leg.asset_id || !leg.deposit_address || !leg.amount_with_suffix) continue;
      const asset = await getAsset(leg.asset_id);
      if (!asset) continue;

      const verifier = getVerifier(asset.verifier);
      if (!verifier.scanAddress) continue;

      const scanned = await verifier.scanAddress(asset, leg.deposit_address);
      const match = scanned.find(tx => tx.amount.toString() === leg.amount_with_suffix);

      if (match) {
        // Found a matching deposit
        await db()
          .from('custody_legs')
          .update({
            tx_hash: match.txHash,
            confirmations: match.confirmations,
            status: match.confirmations >= asset.min_confirmations ? 'CONFIRMED' : 'CONFIRMING',
            verified_at: match.confirmations >= asset.min_confirmations ? new Date().toISOString() : null,
            verified_by: match.confirmations >= asset.min_confirmations ? 'auto' : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leg.id);
        await recomputeTradeStatus(leg.trade_id);
        updated++;
      }
    }
  }

  return updated;
}
