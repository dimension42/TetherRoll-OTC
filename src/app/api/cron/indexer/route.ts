import { AuthError, handleApiError } from '@/lib/auth/guards';
import { runIndexer } from '@/lib/onchain/indexer';

export const dynamic = 'force-dynamic';

/** cron 인증: CRON_SECRET 미설정이면 무조건 거부. Authorization: Bearer <secret> 또는 x-cron-secret 헤더 */
function assertCron(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const provided = req.headers.get('x-cron-secret') || (auth?.startsWith('Bearer ') ? auth.slice(7) : null);
  if (!expected || !provided || provided !== expected) throw new AuthError(401, 'Unauthorized');
}


/**
 * GET /api/cron/indexer — Vercel cron (1분마다).
 * CRON_SECRET 헤더 검증 → 모든 체인 인덱싱.
 */
export async function GET(req: Request) {
  try {
    assertCron(req);

    const results = await runIndexer();
    return Response.json({ ok: true, results });
  } catch (e) {
    return handleApiError(e);
  }
}
