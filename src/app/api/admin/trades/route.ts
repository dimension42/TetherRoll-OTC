import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/trades?kind=&status=&chainId= */
export async function GET(req: Request) {
  try {
    await requireRole('viewer');
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const status = url.searchParams.get('status');
    const chainId = url.searchParams.get('chainId');

    let query = db()
      .from('trades')
      .select('id, kind, status, chain_id, taker_address, maker_address, tx_hash, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (kind) query = query.eq('kind', kind);
    if (status) query = query.eq('status', status);
    if (chainId) query = query.eq('chain_id', parseInt(chainId));

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ trades: data });
  } catch (e) {
    return handleApiError(e);
  }
}
