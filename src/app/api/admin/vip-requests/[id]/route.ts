import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** POST /api/admin/vip-requests/[id] — { action: 'approve' | 'reject', rejectReason?, expiresAt? } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { action, rejectReason, expiresAt } = await req.json();
    const id = params.id;

    if (!['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (action === 'reject' && !rejectReason?.trim()) {
      return Response.json({ error: 'Reject reason required' }, { status: 400 });
    }
    // B-08 fix: validate expiresAt for approval
    if (action === 'approve') {
      if (!expiresAt) {
        return Response.json({ error: 'expiresAt required for approval' }, { status: 400 });
      }
      const expiry = new Date(expiresAt);
      if (isNaN(expiry.getTime()) || expiry <= new Date()) {
        return Response.json({ error: 'expiresAt must be a valid future ISO date' }, { status: 400 });
      }
    }

    const client = db();
    const { data: request } = await client.from('vip_access_requests').select('*').eq('id', id).maybeSingle();
    if (!request || request.status !== 'pending') {
      return Response.json({ error: 'Request not found or already reviewed' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await client.from('vip_access_requests').update({
      status: newStatus,
      reject_reason: action === 'reject' ? rejectReason.trim() : null,
      reviewed_by: admin.id,
      reviewed_at: now,
    }).eq('id', id);

    await client.from('users').update({
      vip_status: action === 'approve' ? 'approved' : 'none',
      vip_expires_at: action === 'approve' ? expiresAt : null,
      updated_at: now,
    }).eq('id', request.user_id);

    await auditLog(admin.id, `vip_request_${action}`, { type: 'vip_access_request', id },
      { status: 'pending' }, { status: newStatus, rejectReason: rejectReason ?? null, expiresAt: expiresAt ?? null });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
