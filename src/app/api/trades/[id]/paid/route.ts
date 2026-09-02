import { z } from 'zod';
import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';

/**
 * POST /api/trades/[id]/paid — FIAT 구매자가 "송금함" 표시 (DB 마커).
 */
const paidSchema = z.object({
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { note: _note } = await parseBody(req, paidSchema);
    const { id } = params;

    const { data: trade } = await db()
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    if (!trade) throw new AuthError(404, 'Trade not found');
    if (trade.buyer_id !== user.id) throw new AuthError(403, 'Not the buyer');

    // paid_at이 null이면 설정 (중복 호출 허용)
    if (!trade.paid_at) {
      await db()
        .from('trades')
        .update({ paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    // note는 별도 저장 (disputes 또는 메타 필드)
    // 간단히 무시 (구현 시 확장 가능)

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
