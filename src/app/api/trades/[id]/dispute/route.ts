import { z } from 'zod';
import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trades/[id]/dispute — 분쟁 제기 (DB disputes 행 생성).
 * 온체인 raiseDispute()는 클라가 전송 후 /confirm.
 */
const disputeSchema = z.object({
  note: z.string(),
  evidencePaths: z.array(z.string()).optional(),
  evidenceHash: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { note, evidencePaths, evidenceHash } = await parseBody(req, disputeSchema);
    const { id } = params;

    const { data: trade } = await db()
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    if (!trade) throw new AuthError(404, 'Trade not found');

    const isParty = trade.seller_id === user.id || trade.buyer_id === user.id;
    if (!isParty) throw new AuthError(403, 'Not a party');

    // disputes 행 생성
    const { error } = await db()
      .from('disputes')
      .insert({
        trade_id: id,
        raised_by: user.id,
        note,
        evidence_paths: evidencePaths ?? [],
        evidence_hash: evidenceHash ?? null,
        status: 'OPEN',
      });

    if (error) throw error;

    // trades.evidence_hash 갱신
    if (evidenceHash) {
      await db()
        .from('trades')
        .update({ evidence_hash: evidenceHash, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return Response.json({ ok: true, message: 'Send on-chain raiseDispute and call /confirm' });
  } catch (e) {
    return handleApiError(e);
  }
}
