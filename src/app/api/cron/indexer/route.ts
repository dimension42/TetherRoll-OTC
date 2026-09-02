import { AuthError, handleApiError } from '@/lib/auth/guards';
import { runIndexer } from '@/lib/onchain/indexer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/indexer — Vercel cron (1분마다).
 * CRON_SECRET 헤더 검증 → 모든 체인 인덱싱.
 */
export async function GET(req: Request) {
  try {
    const secret = req.headers.get('authorization');
    if (!secret || secret !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new AuthError(401, 'Unauthorized');
    }

    const results = await runIndexer();
    return Response.json({ ok: true, results });
  } catch (e) {
    return handleApiError(e);
  }
}
