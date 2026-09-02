import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';
import { verifyPayoutTx } from '../../../_lib/verify';
import { recomputeTradeAfterPayoutExecuted } from '../../../_lib/recompute';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/custody/payouts/[id]/executed — mark payout as executed (ops)
 * Tries to verify tx on-chain, then recomputes trade.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;

    const schema = z.object({
      txHash: z.string().min(1),
      note: z.string().optional(),
    });

    const body = await parseBody(req, schema);

    // Get payout with asset
    const { data: payout, error: fetchErr } = await db()
      .from('custody_payouts')
      .select('*, asset:custody_assets!inner(*)')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!payout) return Response.json({ error: 'Payout not found' }, { status: 404 });

    // Must be APPROVED or (needs_approval=false and REQUESTED)
    const canExecute =
      payout.status === 'APPROVED' || (payout.status === 'REQUESTED' && !payout.needs_approval);

    if (!canExecute) {
      return Response.json({ error: 'Payout not ready for execution' }, { status: 400 });
    }

    // Update payout to EXECUTED
    let finalStatus = 'EXECUTED';
    let verified = false;

    const updates: Record<string, unknown> = {
      status: finalStatus,
      tx_hash: body.txHash,
      executed_by: admin.id,
      executed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (body.note) updates.note = body.note;

    // Try verification
    const asset = (payout as unknown as { asset: unknown }).asset as {
      verifier: string;
      verifier_config: Record<string, unknown>;
      min_confirmations: number;
      decimals: number;
      token_id?: string | null;
      chain_key: string;
    };

    if (asset.verifier !== 'manual') {
      try {
        const result = await verifyPayoutTx(
          asset,
          body.txHash,
          payout.to_address,
          BigInt(payout.amount),
        );

        if (result.found && result.toMatches && result.amount !== null && result.amount >= BigInt(payout.amount)) {
          finalStatus = 'VERIFIED';
          verified = true;
          updates.status = finalStatus;
          updates.verified_at = new Date().toISOString();
        }
      } catch (e) {
        console.error('Payout verification error:', e);
        // Leave as EXECUTED
      }
    }

    const { data: updated, error: updateErr } = await db()
      .from('custody_payouts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await auditLog(admin.id, 'custody_payout.executed', { type: 'custody_payout', id }, payout, updated);

    // Insert onchain_txs record
    await db().from('onchain_txs').insert({
      chain_id: 0, // Custody uses chain_key instead
      chain_key: asset.chain_key,
      hash: body.txHash,
      kind: 'custody_payout',
      ref_type: 'custody_payout',
      ref_id: id,
      status: verified ? 'confirmed' : 'pending',
    });

    // Recompute trade
    await recomputeTradeAfterPayoutExecuted(payout.trade_id);

    return Response.json({ payout: updated, verified });
  } catch (e) {
    return handleApiError(e);
  }
}
