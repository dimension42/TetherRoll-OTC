import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

/** POST /api/admin/treasury/transfers/[id]/reject — { reason } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('admin');
    const { reason } = await req.json();
    const id = params.id;
    if (!reason?.trim()) return Response.json({ error: 'Reason required' }, { status: 400 });

    const client = db();
    const { data: transfer } = await client.from('treasury_transfers').select('*').eq('id', id).maybeSingle();
    if (!transfer) return Response.json({ error: 'Transfer not found' }, { status: 404 });
    if (transfer.status !== 'REQUESTED') {
      return Response.json({ error: 'Transfer not in REQUESTED status' }, { status: 400 });
    }

    await client.from('treasury_transfers').update({
      status: 'REJECTED',
      reject_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await auditLog(admin.id, 'treasury_transfer_reject', { type: 'treasury_transfer', id }, { status: 'REQUESTED' }, { status: 'REJECTED', reason });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
