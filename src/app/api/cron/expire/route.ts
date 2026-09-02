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

    return Response.json({
      ok: true,
      expired: {
        pools: poolsExpired ?? 0,
        trades: tradesExpired ?? 0,
        rolls: rollsExpired ?? 0,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
