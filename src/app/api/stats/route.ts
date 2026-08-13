import { db } from '@/lib/db';
import { handleApiError } from '@/lib/auth/guards';

export async function GET() {
  try {
    const [poolsRes, usersRes] = await Promise.all([
      db().from('pools').select('*', { count: 'exact', head: true }),
      db().from('users').select('*', { count: 'exact', head: true }),
    ]);

    const totalPools = poolsRes.count || 0;
    const totalUsers = usersRes.count || 0;

    // OPEN 풀 개수
    const { count: openPools } = await db()
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'OPEN');

    return Response.json({
      stats: {
        openPools: openPools || 0,
        totalPools,
        totalUsers,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
