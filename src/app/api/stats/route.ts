import { db } from '@/lib/db';
import { handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats — 공개 집계 (랜딩 화면용).
 * 익명 유저에게도 안전한 집계 수치만 노출.
 */
export async function GET() {
  try {
    // OPEN/PARTIAL 풀 개수
    const { count: openPools } = await db()
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .in('status', ['OPEN', 'PARTIAL']);

    // 총 체결 수 (trades CONFIRMED)
    const { count: totalTrades } = await db()
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'CONFIRMED');

    // 총 유저 수
    const { count: totalUsers } = await db()
      .from('users')
      .select('*', { count: 'exact', head: true });

    return Response.json({
      openPools: openPools ?? 0,
      totalTrades: totalTrades ?? 0,
      totalUsers: totalUsers ?? 0,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
