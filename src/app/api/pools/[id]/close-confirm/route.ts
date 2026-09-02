import { z } from 'zod';
import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { confirmTx } from '@/lib/onchain/confirm';

/**
 * POST /api/pools/[id]/close-confirm — cancel/expire tx 확인.
 */
const confirmSchema = z.object({
  txHash: z.string(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await rateLimitByUser(user.id, 'tx_confirm', 120, 60);

    const { txHash } = await parseBody(req, confirmSchema);
    const { id } = params;

    const { data: pool } = await db()
      .from('pools')
      .select('id, creator_id, chain_id, close_tx_hash')
      .eq('id', id)
      .single();

    if (!pool) throw new AuthError(404, 'Pool not found');
    if (pool.creator_id !== user.id) throw new AuthError(403, 'Not your pool');

    // close_tx_hash 설정
    if (!pool.close_tx_hash) {
      await db()
        .from('pools')
        .update({ close_tx_hash: txHash, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    // confirmTx (PoolCancelled 또는 PoolExpired)
    let result = await confirmTx({
      chainId: pool.chain_id,
      hash: txHash,
      expectEvent: 'PoolCancelled',
      user,
    }).catch(() => null);

    if (!result) {
      result = await confirmTx({
        chainId: pool.chain_id,
        hash: txHash,
        expectEvent: 'PoolExpired',
        user,
      });
    }

    if (result.status === 'PENDING') {
      return Response.json({ status: 'PENDING' }, { status: 202 });
    }

    return Response.json({ status: 'CONFIRMED', event: result.args });
  } catch (e) {
    return handleApiError(e);
  }
}
