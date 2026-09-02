import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/announcements */
export async function GET() {
  try {
    await requireRole('viewer');
    const { data, error } = await db()
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Response.json({ announcements: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/admin/announcements — { text, level, expiresAt? } */
export async function POST(req: Request) {
  try {
    const admin = await requireRole('ops');
    const { text, level, expiresAt } = await req.json();
    if (!text?.trim() || !['info', 'warn', 'danger'].includes(level)) {
      return Response.json({ error: 'text and valid level (info/warn/danger) required' }, { status: 400 });
    }

    const client = db();
    const { data, error } = await client.from('announcements').insert({
      text: text.trim(),
      level,
      active: false,
      expires_at: expiresAt || null,
      created_by: admin.id,
    }).select().single();
    if (error) throw error;

    await auditLog(admin.id, 'announcement_create', { type: 'announcement', id: data.id }, null, { text, level, expiresAt });

    return Response.json({ announcement: data });
  } catch (e) {
    return handleApiError(e);
  }
}
