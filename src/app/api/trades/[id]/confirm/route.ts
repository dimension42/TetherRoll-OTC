import { z } from 'zod';
import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { confirmTx } from '@/lib/onchain/confirm';

export const dynamic = 'force-dynamic';

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

    // 생성 tx(take / fiat_create)는 PENDING 행에 tx_hash를 먼저 기록해 applyEvent가 이 행을 갱신하도록 한다.
    // 나머지 kind 는 onchain_trade_id 로 매칭되므로 기록 불필요.
    if ((kind === 'take' || kind === 'fiat_create') && trade.status === 'PENDING') {
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

    const { data: updated } = await db().from('trades').select('id, status, onchain_trade_id').eq('id', id).maybeSingle();
    return Response.json({ status: 'CONFIRMED', event: result.args, trade: updated ?? null });
  } catch (e) {
    return handleApiError(e);
  }
}
