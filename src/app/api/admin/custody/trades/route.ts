import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/custody/trades?status= — list DESK trades (viewer)
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole('viewer');

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = db()
      .from('trades')
      .select(`
        *,
        seller:users!trades_seller_id_fkey(id, email, wallet_address),
        buyer:users!trades_buyer_id_fkey(id, email, wallet_address)
      `)
      .eq('kind', 'DESK')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: trades, error } = await query;

    if (error) throw error;

    // Get legs summary for each trade
    const tradesWithLegs = await Promise.all(
      (trades || []).map(async trade => {
        const { data: legs } = await db()
          .from('custody_legs')
          .select('id, side, kind, status, asset:custody_assets(symbol, chain_key)')
          .eq('trade_id', trade.id);

        return { ...trade, legs: legs || [] };
      }),
    );

    return Response.json({ trades: tradesWithLegs });
  } catch (e) {
    return handleApiError(e);
  }
}
