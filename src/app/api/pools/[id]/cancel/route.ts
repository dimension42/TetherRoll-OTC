import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

/**
 * POST /api/pools/[id]/cancel — DRAFT 상태 풀만 취소 (DB 마킹).
 * 온체인 락 이후엔 409 응답.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { id } = params;

    const { data: pool } = await db()
      .from('pools')
      .select('id, creator_id, status')
      .eq('id', id)
      .single();

    if (!pool) throw new AuthError(404, 'Pool not found');
    if (pool.creator_id !== user.id) throw new AuthError(403, 'Not your pool');

    if (pool.status !== 'DRAFT') {
      throw new AuthError(409, 'Send on-chain cancel and call close-confirm');
    }

    await db()
      .from('pools')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', id);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
