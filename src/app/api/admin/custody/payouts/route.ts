import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/custody/payouts?status= — list payouts (viewer)
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole('viewer');

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = db()
      .from('custody_payouts')
      .select(`
        *,
        asset:custody_assets!inner(id, symbol, chain_key, chain_name, decimals),
        trade:trades!inner(id, kind, status),
        leg:custody_legs(id, side, owner_id),
        requester:users!custody_payouts_requested_by_fkey(id, email),
        approver:users!custody_payouts_approved_by_fkey(id, email),
        executor:users!custody_payouts_executed_by_fkey(id, email)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: payouts, error } = await query;

    if (error) throw error;

    return Response.json({ payouts: payouts || [] });
  } catch (e) {
    return handleApiError(e);
  }
}
