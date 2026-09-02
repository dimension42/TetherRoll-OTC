import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/custody/payouts/[id]/reject — reject payout (ops)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;

    const schema = z.object({
      reason: z.string().min(1),
    });

    const body = await parseBody(req, schema);

    // Get payout
    const { data: payout, error: fetchErr } = await db()
      .from('custody_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!payout) return Response.json({ error: 'Payout not found' }, { status: 404 });

    // Update payout
    const { data: updated, error: updateErr } = await db()
      .from('custody_payouts')
      .update({
        status: 'REJECTED',
        reject_reason: body.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await auditLog(admin.id, 'custody_payout.reject', { type: 'custody_payout', id }, payout, updated);

    return Response.json({ payout: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
