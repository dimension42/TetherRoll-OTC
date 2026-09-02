import { requireUser, handleApiError } from '@/lib/auth/guards';
import { markFiatReceived } from '@/lib/custody/engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trades/[id]/legs/[legId]/received
 * Mark a FIAT leg as received (receiver).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; legId: string }> }) {
  try {
    const { legId } = await params;
    const user = await requireUser();

    await markFiatReceived(legId, user.id);

    return Response.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
