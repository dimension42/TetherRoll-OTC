import { requireUser, handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { cancelDeskTrade } from '@/lib/custody/engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trades/[id]/cancel
 * Cancel a trade. For DESK trades, implements two-party cancellation after deposits.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const { data: trade } = await db().from('trades').select('kind').eq('id', id).maybeSingle();
    if (!trade) {
      return Response.json({ error: 'Trade not found' }, { status: 404 });
    }

    if (trade.kind === 'DESK') {
      await cancelDeskTrade(id, user.id);
      return Response.json({ success: true });
    }

    // For SWAP/FIAT trades, implement existing cancel logic here
    // (placeholder — actual implementation depends on existing code)
    return Response.json({ error: 'Cancel not implemented for this trade type' }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
