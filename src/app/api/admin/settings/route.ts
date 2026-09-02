import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/settings — kill_switch + announcements */
export async function GET() {
  try {
    await requireRole('viewer');
    const client = db();

    const { data: killSwitch } = await client.from('platform_settings').select('value').eq('key', 'kill_switch').maybeSingle();
    const { data: announcements } = await client.from('announcements').select('*').order('created_at', { ascending: false });

    return Response.json({
      settings: {
        killSwitch: killSwitch?.value || { enabled: false, reason: null },
        announcements: announcements || [],
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT /api/admin/settings — { key: 'kill_switch' | 'announcement', value } */
export async function PUT(req: Request) {
  try {
    const admin = await requireRole('admin');
    const { key, value } = await req.json();
    if (!['kill_switch', 'announcement'].includes(key)) {
      return Response.json({ error: 'Invalid key' }, { status: 400 });
    }

    const client = db();
    const { data: existing } = await client.from('platform_settings').select('value').eq('key', key).maybeSingle();

    await client.from('platform_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    await auditLog(admin.id, 'settings_update', { type: 'platform_settings', id: key }, existing?.value, value);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
