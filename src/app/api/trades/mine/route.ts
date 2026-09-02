import { requireUser, handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

/**
 * GET /api/trades/mine — 내 거래 (maker/taker/seller/buyer).
 */
export async function GET() {
  try {
    const user = await requireUser();

    const { data: trades } = await db()
      .from('trades')
      .select('id, pool_id, kind, chain_id, maker_id, taker_id, seller_id, buyer_id, offer_out_wei, request_in_wei, fee_offer_wei, fee_request_wei, token, amount_wei, fiat_currency, fiat_amount, bond_token, bond_amount_wei, deadline, paid_at, released_at, onchain_trade_id, status, tx_hash, created_at')
      .or(`maker_id.eq.${user.id},taker_id.eq.${user.id},seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // pool 정보 추가 (join 대신 별도 조회)
    const poolIds = [...new Set((trades ?? []).map((t: { pool_id: string }) => t.pool_id).filter(Boolean))];
    const { data: pools } = poolIds.length > 0
      ? await db()
          .from('pools')
          .select('id, kind, visibility, chain_id, status, offer_token, request_token, fiat_currency')
          .in('id', poolIds)
      : { data: [] };

    const poolMap = new Map((pools ?? []).map((p: { id: string }) => [p.id, p]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tradesWithPools = (trades ?? []).map((t: any) => ({
      ...t,
      pool: t.pool_id ? poolMap.get(t.pool_id) : null,
    }));

    return Response.json({ trades: tradesWithPools });
  } catch (e) {
    return handleApiError(e);
  }
}
