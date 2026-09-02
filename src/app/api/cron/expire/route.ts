import { AuthError, handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

/**
 * GET /api/cron/expire — Vercel cron (5분마다).
 * 만료된 pools/trades/roll_orders를 EXPIRED로 마킹.
 */
export async function GET(req: Request) {
  try {
    const secret = req.headers.get('authorization');
    if (!secret || secret !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new AuthError(401, 'Unauthorized');
    }

    const now = new Date().toISOString();

    // pools: OPEN/PARTIAL 중 expires_at 경과
    const poolsRes = await db()
      .from('pools')
      .update({ status: 'EXPIRED', updated_at: now })
      .in('status', ['OPEN', 'PARTIAL'])
      .lte('expires_at', now)
      .select();
    const poolsExpired = poolsRes.data?.length ?? 0;

    // trades: AWAITING_BOND/ACTIVE 중 deadline 경과 (FIAT)
    const tradesRes = await db()
      .from('trades')
      .update({ status: 'EXPIRED', updated_at: now })
      .in('status', ['AWAITING_BOND', 'ACTIVE'])
      .lte('deadline', now)
      .select();
    const tradesExpired = tradesRes.data?.length ?? 0;

    // roll_orders: AWAITING_DEPOSIT 중 expires_at 경과
    const rollsRes = await db()
      .from('roll_orders')
      .update({ status: 'EXPIRED', updated_at: now })
      .eq('status', 'AWAITING_DEPOSIT')
      .lte('expires_at', now)
      .select();
    const rollsExpired = rollsRes.data?.length ?? 0;

    // 온체인 락 없이 24시간 이상 방치된 DRAFT/LOCKING 풀 정리 (tx 미전송 또는 유실)
    const staleCutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const staleRes = await db()
      .from('pools')
      .update({ status: 'CANCELLED', updated_at: now })
      .in('status', ['DRAFT', 'LOCKING'])
      .lte('created_at', staleCutoff)
      .select();
    const staleCancelled = staleRes.data?.length ?? 0;

    // 레이트리밋 윈도우 행 정리 (1일 이상 지난 것)
    const rlCutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await db().from('rate_limits').delete().lte('window_start', rlCutoff);

    return Response.json({
      ok: true,
      expired: {
        pools: poolsExpired ?? 0,
        trades: tradesExpired ?? 0,
        rolls: rollsExpired ?? 0,
        staleDrafts: staleCancelled,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
