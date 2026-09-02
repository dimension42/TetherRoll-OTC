import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/treasury/transfers */
export async function GET() {
  try {
    await requireRole('viewer');
    const { data, error } = await db()
      .from('treasury_transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return Response.json({ transfers: data });
  } catch (e) {
    return handleApiError(e);
  }
}
