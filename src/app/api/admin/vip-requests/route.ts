import { db } from '@/lib/db';
import { requireAdmin, auditLog, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/vip-requests?status=pending */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const status = new URL(req.url).searchParams.get('status') ?? 'pending';
    const { data, error } = await db()
      .from('vip_access_requests')
      .select('id, user_id, reason, expected_volume, contact, status, reject_reason, created_at, reviewed_at, users:user_id (email, wallet_address, display_name)')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    return Response.json({ requests: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/admin/vip-requests — { id, action: 'approve' | 'reject', rejectReason?, expiresAt? } */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const { id, action, rejectReason, expiresAt } = await req.json();
    if (!id || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (action === 'reject' && !rejectReason?.trim()) {
      return Response.json({ error: 'Reject reason required' }, { status: 400 });
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
      vip_expires_at: action === 'approve' ? (expiresAt ?? null) : null,
      updated_at: now,
    }).eq('id', request.user_id);

    await auditLog(admin.id, `vip_request_${action}`, { type: 'vip_access_request', id },
      { status: 'pending' }, { status: newStatus, rejectReason: rejectReason ?? null });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
