import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/announcements/[id] — { text?, level?, active?, expiresAt? } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { text, level, active, expiresAt } = await req.json();
    const id = params.id;

    const client = db();
    const { data: existing } = await client.from('announcements').select('*').eq('id', id).maybeSingle();
    if (!existing) return Response.json({ error: 'Announcement not found' }, { status: 404 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (text !== undefined) update.text = text.trim();
    if (level !== undefined) {
      if (!['info', 'warn', 'danger'].includes(level)) {
        return Response.json({ error: 'Invalid level' }, { status: 400 });
      }
      update.level = level;
    }
    if (active !== undefined) update.active = active;
    if (expiresAt !== undefined) update.expires_at = expiresAt;

    await client.from('announcements').update(update).eq('id', id);
    await auditLog(admin.id, 'announcement_update', { type: 'announcement', id }, existing, update);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
