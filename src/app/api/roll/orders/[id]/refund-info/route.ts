import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireVip, handleApiError, AuthError } from '@/lib/auth/guards';
import { parseBody } from '@/lib/roll/http';
import { encrypt } from '@/lib/roll/crypto';
import { db } from '@/lib/db';

const schema = z.object({
  bank: z.string().min(1),
  account: z.string().min(1),
  holder: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireVip();
    const { id } = params;
    const body = await parseBody(req, schema);

    // Check order ownership and status
    const { data: order } = await db()
      .from('roll_orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    // Update refund row if exists
    const plainBank = JSON.stringify(body);
    const encBank = encrypt(plainBank);

    const { data: existingRefund } = await db()
      .from('refunds')
      .select('id')
      .eq('roll_order_id', id)
      .maybeSingle();

    if (existingRefund) {
      await db().from('refunds').update({ bank_info_enc: encBank }).eq('id', existingRefund.id);
    } else {
      // Create a pending refund row (will be populated at settlement)
      await db().from('refunds').insert({
        roll_order_id: id,
        amount_krw: '0', // will be updated at settlement
        bank_info_enc: encBank,
        status: 'REQUESTED',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
