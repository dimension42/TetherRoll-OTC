import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

/**
 * POST /api/trades/[id]/received — FIAT 판매자가 "수령함" 표시 (DB 마커).
 * 실제 릴리즈는 온체인 confirmReceived() 전송 후 confirm 엔드포인트.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { id } = params;

    const { data: trade } = await db()
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    if (!trade) throw new AuthError(404, 'Trade not found');
    if (trade.seller_id !== user.id) throw new AuthError(403, 'Not the seller');

    // DB 마커 (released_at은 confirmReceived 이벤트가 설정)
    // 여기선 단순 확인 응답
    return Response.json({ ok: true, message: 'Send on-chain confirmReceived and call /confirm' });
  } catch (e) {
    return handleApiError(e);
  }
}
