import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/vip-requests — all requests */
export async function GET() {
  try {
    await requireRole('viewer');
    const { data, error } = await db()
      .from('vip_access_requests')
      .select('id, user_id, reason, expected_volume, contact, status, reject_reason, created_at, reviewed_at, users:user_id (email, wallet_address, display_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return Response.json({ requests: data });
  } catch (e) {
    return handleApiError(e);
  }
}

// PATCH removed - use POST /api/admin/vip-requests/[id] instead
