import { requireUser, handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pools/mine — 내가 만든 풀 + 내가 참여한 풀 (trades 통해).
 */
export async function GET() {
  try {
    const user = await requireUser();

    // 내가 만든 풀
    const { data: created } = await db()
      .from('pools')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    // 내가 참여한 거래가 있는 풀 ID
    const { data: trades } = await db()
      .from('trades')
      .select('pool_id')
      .or(`maker_id.eq.${user.id},taker_id.eq.${user.id},seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .not('pool_id', 'is', null);

    const poolIds = [...new Set((trades ?? []).map((t: { pool_id: string }) => t.pool_id))];

    const { data: participated } = poolIds.length > 0
      ? await db()
          .from('pools')
          .select('*')
          .in('id', poolIds)
          .order('created_at', { ascending: false })
      : { data: [] };

    // 중복 제거 (created와 participated 겹칠 수 있음)
    const allIds = new Set((created ?? []).map((p: { id: string }) => p.id));
    const unique = [...(created ?? []), ...(participated ?? []).filter((p: { id: string }) => !allIds.has(p.id))];

    return Response.json({ pools: unique });
  } catch (e) {
    return handleApiError(e);
  }
}
