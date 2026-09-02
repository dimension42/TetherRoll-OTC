import { z } from 'zod';
import { requireUser, handleApiError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { submitLegTx } from '@/lib/custody/engine';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  txHash: z.string().min(10),
});

/**
 * POST /api/trades/[id]/legs/[legId]/submit
 * Submit a tx hash for a CRYPTO leg (DESK trades).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; legId: string }> }) {
  try {
    const { legId } = await params;
    const user = await requireUser();
    const { txHash } = await parseBody(req, submitSchema);

    await submitLegTx(legId, txHash, user.id);

    return Response.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
