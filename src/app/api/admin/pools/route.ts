import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/pools?status=&chainId=&visibility= */
export async function GET(req: Request) {
  try {
    await requireRole('viewer');
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const chainId = url.searchParams.get('chainId');
    const visibility = url.searchParams.get('visibility');

    let query = db()
      .from('pools')
      .select('id, status, visibility, trade_type, offer_symbol, request_symbol, offer_amount, created_at, creator_id, chain_id')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) query = query.eq('status', status);
    if (chainId) query = query.eq('chain_id', parseInt(chainId));
    if (visibility) query = query.eq('visibility', visibility);

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ pools: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/admin/pools — { id, action: 'hide' | 'unhide' | 'force_close', reason } */
export async function PATCH(req: Request) {
  try {
    const admin = await requireRole('ops');
    const { id, action, reason } = await req.json();
    if (!id || !['hide', 'unhide', 'force_close'].includes(action)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if ((action === 'hide' || action === 'force_close') && !reason?.trim()) {
      return Response.json({ error: 'Reason required' }, { status: 400 });
    }

    const client = db();
    const { data: pool } = await client.from('pools').select('id, status').eq('id', id).maybeSingle();
    if (!pool) return Response.json({ error: 'Pool not found' }, { status: 404 });

    const newStatus = action === 'hide' || action === 'force_close' ? 'HIDDEN' : pool.status;
    await client.from('pools').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await auditLog(admin.id, `pool_${action}`, { type: 'pool', id }, { status: pool.status }, { status: newStatus, reason });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
