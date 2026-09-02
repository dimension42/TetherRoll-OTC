import { handleApiError, AuthError } from '@/lib/auth/guards';
import { refreshConfirming, expireDeskTrades } from '@/lib/custody/engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/custody
 * Cron job: refresh CONFIRMING legs, auto-scan PENDING legs, expire trades.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: Request) {
  try {
    const secret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (secret !== process.env.CRON_SECRET) {
      throw new AuthError(401, 'Unauthorized');
    }

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
