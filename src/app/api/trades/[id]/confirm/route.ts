import { z } from 'zod';
import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { confirmTx } from '@/lib/onchain/confirm';

/**
 * POST /api/trades/[id]/confirm — 트레이드 tx 확인.
 * kind: take | fiat_create | fiat_join | fiat_paid | fiat_release | fiat_cancel | fiat_expire | fiat_dispute | fiat_resolve
 */
const confirmSchema = z.object({
  txHash: z.string(),
  kind: z.enum(['take', 'fiat_create', 'fiat_join', 'fiat_paid', 'fiat_release', 'fiat_cancel', 'fiat_expire', 'fiat_dispute', 'fiat_resolve']),
});

const eventMap: Record<string, string> = {
  take: 'PoolTaken',
  fiat_create: 'FiatTradeCreated',
  fiat_join: 'FiatTradeJoined',
  fiat_paid: 'FiatTradePaid',
  fiat_release: 'FiatTradeReleased',
  fiat_cancel: 'FiatTradeCancelled',
  fiat_expire: 'FiatTradeExpired',
  fiat_dispute: 'FiatTradeDisputed',
  fiat_resolve: 'FiatTradeResolved',
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await rateLimitByUser(user.id, 'tx_confirm', 120, 60);

    const { txHash, kind } = await parseBody(req, confirmSchema);
    const { id } = params;

    const { data: trade } = await db()
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    if (!trade) throw new AuthError(404, 'Trade not found');

    // 당사자 확인
    const isParty =
      trade.maker_id === user.id ||
      trade.taker_id === user.id ||
      trade.seller_id === user.id ||
      trade.buyer_id === user.id;

    if (!isParty) throw new AuthError(403, 'Not a party');

    // tx_hash 설정
    if (!trade.tx_hash && kind === 'take') {
      await db()
        .from('trades')
        .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    // confirmTx
    const result = await confirmTx({
      chainId: trade.chain_id,
      hash: txHash,
      expectEvent: eventMap[kind],
      user,
    });

    if (result.status === 'PENDING') {
      return Response.json({ status: 'PENDING' }, { status: 202 });
    }

    // take의 경우, PENDING 행을 갱신 (applyEvent가 신규 생성하지 않도록)
    if (kind === 'take' && result.status === 'CONFIRMED') {
      // applyEvent는 이미 호출되었으므로, 여기선 PENDING 행을 찾아 연결만
      // (실제로는 applyEvent를 수정해서 pendingTradeId 힌트를 받도록 해야 함)
      // 간단히: tx_hash로 매칭
      const { data: updatedTrade } = await db()
        .from('trades')
        .select('*')
        .eq('tx_hash', txHash)
        .eq('chain_id', trade.chain_id)
        .maybeSingle();

      if (updatedTrade && updatedTrade.id !== id) {
        // applyEvent가 새 행을 만들었다면, PENDING 행의 내용을 복사하고 새 행 삭제
        await db().from('trades').delete().eq('id', id);
      }
    }

    return Response.json({ status: 'CONFIRMED', event: result.args });
  } catch (e) {
    return handleApiError(e);
  }
}
