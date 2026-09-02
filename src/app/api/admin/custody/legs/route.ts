import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/custody/legs?status=&assetId= — list legs with filters (viewer)
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole('viewer');

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const assetId = searchParams.get('assetId');

    let query = db()
      .from('custody_legs')
      .select(`
        *,
        trade:trades!inner(id, kind, status),
        owner:users!custody_legs_owner_id_fkey(id, email, wallet_address),
        asset:custody_assets(id, symbol, chain_key, chain_name)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (assetId) {
      query = query.eq('asset_id', assetId);
    }

    const { data: legs, error } = await query;

    if (error) throw error;

    return Response.json({ legs: legs || [] });
  } catch (e) {
    return handleApiError(e);
  }
}
