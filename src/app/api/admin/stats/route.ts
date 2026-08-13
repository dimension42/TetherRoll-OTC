import { db } from '@/lib/db';
import { requireAdmin, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/stats — KPI 카운트 집계 */
export async function GET() {
  try {
    await requireAdmin();
    const client = db();

    // 병렬 카운트 쿼리
    const [
      totalUsersRes,
      vipPendingRes,
      vipApprovedRes,
      poolsOpenRes,
      poolsTotalRes,
      bannedUsersRes,
    ] = await Promise.all([
      client.from('users').select('*', { count: 'exact', head: true }),
      client.from('vip_access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('users').select('*', { count: 'exact', head: true }).eq('vip_status', 'approved'),
      client.from('pools').select('*', { count: 'exact', head: true }).in('status', ['OPEN', 'PARTIAL']),
      client.from('pools').select('*', { count: 'exact', head: true }),
      client.from('users').select('*', { count: 'exact', head: true }).not('banned_at', 'is', null),
    ]);

    return Response.json({
      stats: {
        totalUsers: totalUsersRes.count ?? 0,
        vipPending: vipPendingRes.count ?? 0,
        vipApproved: vipApprovedRes.count ?? 0,
        poolsOpen: poolsOpenRes.count ?? 0,
        poolsTotal: poolsTotalRes.count ?? 0,
        bannedUsers: bannedUsersRes.count ?? 0,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
