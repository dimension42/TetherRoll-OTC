import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** POST /api/admin/treasury/transfers/[id]/approve */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('admin');
    const id = params.id;

    const client = db();
    const { data: transfer } = await client.from('treasury_transfers').select('*').eq('id', id).maybeSingle();
    if (!transfer) return Response.json({ error: 'Transfer not found' }, { status: 404 });
    if (transfer.status !== 'REQUESTED') {
      return Response.json({ error: 'Transfer not in REQUESTED status' }, { status: 400 });
    }
    if (transfer.requested_by === admin.id) {
      return Response.json({ error: 'Approver cannot be the requester (2-person rule)' }, { status: 403 });
    }

    await client.from('treasury_transfers').update({
      status: 'APPROVED',
      approved_by: admin.id,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await auditLog(admin.id, 'treasury_transfer_approve', { type: 'treasury_transfer', id }, { status: 'REQUESTED' }, { status: 'APPROVED' });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
