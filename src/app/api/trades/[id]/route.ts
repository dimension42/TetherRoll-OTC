import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { decryptJson } from '@/lib/crypto';

/**
 * GET /api/trades/[id] — 거래 상세 (당사자만).
 * 판매자 bank_info는 구매자에게만, 그리고 status가 PENDING/AWAITING_BOND/ACTIVE/PAID일 때만 복호화.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
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

    if (!isParty) throw new AuthError(404, 'Not found');

    // bank_info_enc 복호화 (buyer에게만, 특정 상태에서만)
    let bankInfo = null;
    if (
      trade.bank_info_enc &&
      trade.buyer_id === user.id &&
      ['PENDING', 'AWAITING_BOND', 'ACTIVE', 'PAID'].includes(trade.status)
    ) {
      bankInfo = decryptJson(trade.bank_info_enc);
    }

    // bank_info_enc 필드 제거
    const { bank_info_enc: _removed, ...tradeSafe } = trade;

    return Response.json({ trade: { ...tradeSafe, bankInfo } });
  } catch (e) {
    return handleApiError(e);
  }
}
