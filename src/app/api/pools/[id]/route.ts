import { db } from '@/lib/db';
import { requireVip, handleApiError } from '@/lib/auth/guards';

/**
 * GET /api/pools/[id] — 풀 상세 조회.
 * VIP 풀은 requireVip() 호출 → 미승인은 404.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 풀 조회
    const { data: pool, error } = await db()
      .from('pools')
      .select('id, visibility, trade_type, offer_symbol, offer_chain, offer_amount, request_symbol, request_chain, request_amount, fiat_currency, collateral_mode, collateral_pct, status, filled_pct, chain_id, expires_at, created_at')
      .eq('id', id)
      .neq('status', 'HIDDEN')
      .maybeSingle();

    if (error) throw error;
    if (!pool) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // VIP 풀이면 requireVip() 가드
    if (pool.visibility === 'vip') {
      await requireVip();
    }

    return Response.json({ pool });
  } catch (e) {
    return handleApiError(e);
  }
}
