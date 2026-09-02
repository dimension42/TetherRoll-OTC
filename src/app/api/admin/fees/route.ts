import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** GET /api/admin/fees — 전체 이력 + 최신값 */
export async function GET() {
  try {
    await requireRole('viewer');
    const { data, error } = await db()
      .from('fee_configs')
      .select('*')
      .order('changed_at', { ascending: false });
    if (error) throw error;
    return Response.json({ fees: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/admin/fees — { key, value, venueId? } insert-only */
export async function POST(req: Request) {
  try {
    const admin = await requireRole('admin');
    const { key, value, venueId } = await req.json();
    if (!key || value === undefined) {
      return Response.json({ error: 'key and value required' }, { status: 400 });
    }

    const client = db();
    const { error } = await client.from('fee_configs').insert({
      key,
      value,
      venue_id: venueId || null,
      changed_by: admin.id,
      changed_at: new Date().toISOString(),
    });
    if (error) throw error;

    await auditLog(admin.id, 'fee_config_update', { type: 'fee_config', id: key }, null, { key, value, venueId });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
