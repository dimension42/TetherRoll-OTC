import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** GET /api/admin/disputes?status= */
export async function GET(req: Request) {
  try {
    await requireRole('viewer');
    const status = new URL(req.url).searchParams.get('status');

    let query = db()
      .from('disputes')
      .select('id, trade_id, status, note, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ disputes: data });
  } catch (e) {
    return handleApiError(e);
  }
}
