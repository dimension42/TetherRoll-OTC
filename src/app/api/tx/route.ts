import { z } from 'zod';
import { requireUser, handleApiError } from '@/lib/auth/guards';
import { parseBody, zChainId } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';

/**
 * POST /api/tx — 온체인 tx 기록 (PENDING).
 */
const txSchema = z.object({
  chainId: zChainId,
  hash: z.string(),
  kind: z.string(),
  refType: z.string().optional(),
  refId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await rateLimitByUser(user.id, 'tx_log', 120, 60);

    const { chainId, hash, kind, refType, refId } = await parseBody(req, txSchema);

    const { error } = await db()
      .from('onchain_txs')
      .upsert(
        {
          user_id: user.id,
          chain_id: chainId,
          hash,
          kind,
          ref_type: refType ?? null,
          ref_id: refId ?? null,
          status: 'PENDING',
        },
        { onConflict: 'chain_id,hash', ignoreDuplicates: true }
      );

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
