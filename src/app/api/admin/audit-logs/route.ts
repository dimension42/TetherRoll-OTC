import { db } from '@/lib/db';
import { requireAdmin, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/audit-logs */
export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await db()
      .from('admin_audit_logs')
      .select('id, action, target_type, target_id, before, after, created_at, users:admin_id (email, display_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return Response.json({ logs: data });
  } catch (e) {
    return handleApiError(e);
  }
}
