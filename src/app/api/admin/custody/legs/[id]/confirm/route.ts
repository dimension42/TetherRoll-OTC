import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';
import { recomputeTradeAfterLegConfirm } from '../../../_lib/recompute';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/custody/legs/[id]/confirm — confirm leg (ops)
 * Sets status to CONFIRMED, verified_by = admin, then recomputes trade.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;

    const schema = z.object({
      txHash: z.string().optional(),
      note: z.string().optional(),
    });

    const body = await parseBody(req, schema);

    // Get leg
    const { data: leg, error: fetchErr } = await db()
      .from('custody_legs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!leg) return Response.json({ error: 'Leg not found' }, { status: 404 });

    if (leg.status === 'CONFIRMED') {
      return Response.json({ error: 'Leg already confirmed' }, { status: 400 });
    }

    // Update leg
    const updates: Record<string, unknown> = {
      status: 'CONFIRMED',
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (body.txHash) updates.tx_hash = body.txHash;
    if (body.note) updates.note = body.note;

    const { data: updated, error: updateErr } = await db()
      .from('custody_legs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await auditLog(admin.id, 'custody_leg.confirm', { type: 'custody_leg', id }, leg, updated);

    // Recompute trade
    await recomputeTradeAfterLegConfirm(leg.trade_id);

    return Response.json({ leg: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
