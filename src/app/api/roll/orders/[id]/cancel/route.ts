import { NextResponse } from 'next/server';
import { requireVip, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireVip();
    const { id } = params;

    const { data: order } = await db()
      .from('roll_orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    if (order.status !== 'AWAITING_DEPOSIT') {
      throw new AuthError(400, 'Can only cancel orders awaiting deposit');
    }

    await db().from('roll_orders').update({ status: 'CANCELLED' }).eq('id', id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
