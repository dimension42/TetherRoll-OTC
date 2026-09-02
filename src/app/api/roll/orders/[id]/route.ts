import { NextResponse } from 'next/server';
import { requireVip, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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

    // Fetch fills
    const { data: fills } = await db()
      .from('roll_fills')
      .select('*')
      .eq('roll_order_id', id)
      .order('created_at', { ascending: true });

    // Fetch refund if exists
    const { data: refund } = await db()
      .from('refunds')
      .select('*')
      .eq('roll_order_id', id)
      .maybeSingle();

    // Include deposit instructions if still awaiting deposit
    let deposit = null;
    if (order.status === 'AWAITING_DEPOSIT') {
      const bankName = process.env.ROLL_BANK_NAME;
      const bankAccount = process.env.ROLL_BANK_ACCOUNT;
      const bankHolder = process.env.ROLL_BANK_HOLDER;
      const configured = !!(bankName && bankAccount && bankHolder);
      deposit = {
        configured,
        bank: bankName ?? null,
        account: bankAccount ?? null,
        holder: bankHolder ?? null,
        amountKrw: parseFloat(order.amount_krw),
        code: order.deposit_code,
      };
    }

    return NextResponse.json({
      order,
      fills: fills ?? [],
      refund: refund ?? null,
      deposit,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
