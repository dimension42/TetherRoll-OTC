import { z } from 'zod';
import { requireUser, requireVip, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { confirmTx } from '@/lib/onchain/confirm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pools/[id] — 풀 상세 + trades (내가 당사자인 것).
 * VIP 풀은 requireVip().
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const { data: pool, error } = await db()
      .from('pools')
      .select('*')
      .eq('id', id)
      .neq('status', 'HIDDEN')
      .maybeSingle();

    if (error) throw error;
    if (!pool) throw new AuthError(404, 'Not found');

    if (pool.visibility === 'vip') {
      await requireVip();
    }

    // trades (내가 당사자인 것만, bank_info_enc 제외)
    const user = await requireUser().catch(() => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let trades: any[] = [];
    if (user) {
      const { data } = await db()
        .from('trades')
        .select('id, kind, chain_id, maker_id, taker_id, seller_id, buyer_id, maker_address, taker_address, seller_address, buyer_address, offer_out_wei, request_in_wei, fee_offer_wei, fee_request_wei, token, amount_wei, fiat_currency, fiat_amount, bond_token, bond_amount_wei, deadline, release_window_sec, paid_at, released_at, onchain_trade_id, evidence_hash, status, tx_hash, created_at')
        .eq('pool_id', id)
        .or(`maker_id.eq.${user.id},taker_id.eq.${user.id},seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      trades = data ?? [];
    }

    return Response.json({ pool, trades });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/pools/[id]/confirm — 풀 생성 tx 확인 (PoolCreated 이벤트). */
const confirmSchema = z.object({
  txHash: z.string(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await rateLimitByUser(user.id, 'tx_confirm', 120, 60); // 120/min

    const { txHash } = await parseBody(req, confirmSchema);
    const { id } = params;

    // 풀이 DRAFT/LOCKING이고 creator가 본인인지 확인
    const { data: pool } = await db()
      .from('pools')
      .select('id, creator_id, status, chain_id')
      .eq('id', id)
      .in('status', ['DRAFT', 'LOCKING'])
      .single();

    if (!pool) throw new AuthError(404, 'Pool not found or not in DRAFT/LOCKING');
    if (pool.creator_id !== user.id) throw new AuthError(403, 'Not your pool');

    // create_tx_hash 설정 (applyEvent가 찾을 수 있도록)
    await db()
      .from('pools')
      .update({ create_tx_hash: txHash, status: 'LOCKING', updated_at: new Date().toISOString() })
      .eq('id', id);

    // confirmTx
    const result = await confirmTx({
      chainId: pool.chain_id,
      hash: txHash,
      expectEvent: 'PoolCreated',
      user,
    });

    if (result.status === 'PENDING') {
      return Response.json({ status: 'PENDING' }, { status: 202 });
    }

    return Response.json({ status: 'CONFIRMED', event: result.args });
  } catch (e) {
    return handleApiError(e);
  }
}
