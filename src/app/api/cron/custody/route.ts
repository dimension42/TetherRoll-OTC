import { handleApiError, AuthError } from '@/lib/auth/guards';
import { refreshConfirming, expireDeskTrades } from '@/lib/custody/engine';

export const dynamic = 'force-dynamic';

/** cron 인증: CRON_SECRET 미설정이면 무조건 거부. Authorization: Bearer <secret> 또는 x-cron-secret 헤더 */
function assertCron(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const provided = req.headers.get('x-cron-secret') || (auth?.startsWith('Bearer ') ? auth.slice(7) : null);
  if (!expected || !provided || provided !== expected) throw new AuthError(401, 'Unauthorized');
}


/**
 * GET /api/cron/custody
 * Cron job: refresh CONFIRMING legs, auto-scan PENDING legs, expire trades.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: Request) {
  try {
    assertCron(req);

    const refreshed = await refreshConfirming();
    const expired = await expireDeskTrades();

    return Response.json({
      success: true,
      refreshed,
      expired,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
