import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/users?q=... — 유저 검색 (B-02 수정: 안전한 검색) */
export async function GET(req: Request) {
  try {
    await requireRole('viewer');
    const q = new URL(req.url).searchParams.get('q')?.trim();
    let query = db()
      .from('users')
      .select('id, email, wallet_address, display_name, role, vip_status, banned_at, ban_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (q) {
      // B-02 fix: sanitize q — strip special chars that break .or() syntax
      const safe = q.replace(/[,()%]/g, '');
      if (safe) {
        // Manually build OR conditions to avoid interpolation injection
        query = query.or(`email.ilike.%${safe}%,wallet_address.ilike.%${safe}%,display_name.ilike.%${safe}%`);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ users: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/admin/users — { id, action: 'ban' | 'unban' | 'revoke_vip' | 'set_role', reason?, role? } */
export async function PATCH(req: Request) {
  try {
    const admin = await requireRole('ops'); // ops can ban/unban, admin can set_role
    const { id, action, reason, role } = await req.json();
    if (!id || !['ban', 'unban', 'revoke_vip', 'set_role'].includes(action)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (action === 'ban' && !reason?.trim()) {
      return Response.json({ error: 'Ban reason required' }, { status: 400 });
    }
    if (action === 'set_role') {
      await requireRole('admin'); // only admin can change roles
      if (!['user', 'viewer', 'ops', 'admin'].includes(role)) {
        return Response.json({ error: 'Invalid role' }, { status: 400 });
      }
    }
    if (id === admin.id && action === 'set_role') {
      return Response.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    const client = db();
    const { data: target } = await client.from('users').select('id, banned_at, vip_status, role').eq('id', id).maybeSingle();
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    const now = new Date().toISOString();
    const patch =
      action === 'ban' ? { banned_at: now, ban_reason: reason.trim() } :
      action === 'unban' ? { banned_at: null, ban_reason: null } :
      action === 'revoke_vip' ? { vip_status: 'revoked' as const, vip_expires_at: null } :
      { role };

    await client.from('users').update({ ...patch, updated_at: now }).eq('id', id);
    await auditLog(admin.id, `user_${action}`, { type: 'user', id },
      { banned_at: target.banned_at, vip_status: target.vip_status, role: target.role }, patch);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
