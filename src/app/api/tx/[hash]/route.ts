import { z } from 'zod';
import { handleApiError, AuthError } from '@/lib/auth/guards';
import { parseQuery, zChainId } from '@/lib/validate';
import { db } from '@/lib/db';
import { publicClientFor } from '@/lib/onchain/client';

/**
 * GET /api/tx/[hash]?chainId= — tx 조회 + live receipt 상태.
 */
const querySchema = z.object({
  chainId: zChainId,
});

export async function GET(req: Request, { params }: { params: { hash: string } }) {
  try {
    const url = new URL(req.url);
    const { chainId } = parseQuery(url, querySchema);
    const { hash } = params;

    const { data: tx } = await db()
      .from('onchain_txs')
      .select('*')
      .eq('chain_id', chainId)
      .eq('hash', hash)
      .maybeSingle();

    if (!tx) throw new AuthError(404, 'Tx not found');

    // live receipt 조회
    const client = publicClientFor(chainId);
    const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null);

    let liveStatus = 'PENDING';
    if (receipt) {
      liveStatus = receipt.status === 'success' ? 'CONFIRMED' : 'FAILED';

      // DB 갱신
      if (tx.status === 'PENDING') {
        await db()
          .from('onchain_txs')
          .update({
            status: liveStatus,
            block_number: Number(receipt.blockNumber),
            gas_used: receipt.gasUsed.toString(),
            confirmed_at: new Date().toISOString(),
          })
          .eq('chain_id', chainId)
          .eq('hash', hash);
      }
    }

    return Response.json({ tx: { ...tx, liveStatus } });
  } catch (e) {
    return handleApiError(e);
  }
}
