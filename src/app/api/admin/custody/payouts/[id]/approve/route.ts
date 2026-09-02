import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/custody/payouts/[id]/approve — approve payout (ops)
 * Enforces approver ≠ requester when requested_by is not null.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;

    // Get payout
    const { data: payout, error: fetchErr } = await db()
      .from('custody_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!payout) return Response.json({ error: 'Payout not found' }, { status: 404 });

    if (payout.status !== 'REQUESTED') {
      return Response.json({ error: 'Payout not in REQUESTED status' }, { status: 400 });
    }

    // If needs_approval is false, this is a no-op success
    if (!payout.needs_approval) {
      return Response.json({ payout, message: 'No approval needed' });
    }

    // Enforce approver ≠ requester
    if (payout.requested_by && payout.requested_by === admin.id) {
      return Response.json({ error: 'Cannot approve your own request' }, { status: 403 });
    }

    // Update payout
    const { data: updated, error: updateErr } = await db()
      .from('custody_payouts')
      .update({
        status: 'APPROVED',
        approved_by: admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await auditLog(admin.id, 'custody_payout.approve', { type: 'custody_payout', id }, payout, updated);

    return Response.json({ payout: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
