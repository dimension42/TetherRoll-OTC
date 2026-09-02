import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/whitelist */
export async function GET() {
  try {
    await requireRole('viewer');
    const { data, error } = await db().from('whitelist_addresses').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return Response.json({ whitelist: data });
  } catch (e) {
    return handleApiError(e);
  }
}
