import { db } from '@/lib/db';
import { requireAdmin, auditLog, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/users?q=... — 유저 검색 (밴 관리용) */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const q = new URL(req.url).searchParams.get('q')?.trim();
    let query = db()
      .from('users')
      .select('id, email, wallet_address, display_name, role, vip_status, banned_at, ban_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (q) query = query.or(`email.ilike.%${q}%,wallet_address.ilike.%${q}%,display_name.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ users: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/admin/users — { id, action: 'ban' | 'unban' | 'revoke_vip', reason? } */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const { id, action, reason } = await req.json();
    if (!id || !['ban', 'unban', 'revoke_vip'].includes(action)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (action === 'ban' && !reason?.trim()) {
      return Response.json({ error: 'Ban reason required' }, { status: 400 });
    }
    if (id === admin.id) return Response.json({ error: 'Cannot act on yourself' }, { status: 400 });

    const client = db();
    const { data: target } = await client.from('users').select('id, banned_at, vip_status').eq('id', id).maybeSingle();
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    const now = new Date().toISOString();
    const patch =
      action === 'ban' ? { banned_at: now, ban_reason: reason.trim() } :
      action === 'unban' ? { banned_at: null, ban_reason: null } :
      { vip_status: 'revoked' as const, vip_expires_at: null };

    await client.from('users').update({ ...patch, updated_at: now }).eq('id', id);
    await auditLog(admin.id, `user_${action}`, { type: 'user', id },
      { banned_at: target.banned_at, vip_status: target.vip_status }, patch);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
