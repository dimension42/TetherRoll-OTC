import { NextResponse } from 'next/server';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;

    const { data: order } = await db()
      .from('roll_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    if (order.status !== 'FROZEN') {
      throw new AuthError(400, 'Can only force-refund from FROZEN status');
    }

    const depositAmount = parseFloat(order.deposit_amount_krw ?? order.amount_krw);

    await db()
      .from('roll_orders')
      .update({
        status: 'REFUNDED',
        refund_krw: depositAmount.toString(),
        settled_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Create refund
    const { data: existingRefund } = await db()
      .from('refunds')
      .select('*')
      .eq('roll_order_id', id)
      .maybeSingle();

    if (existingRefund) {
      await db()
        .from('refunds')
        .update({
          amount_krw: depositAmount.toString(),
          status: 'REQUESTED',
        })
        .eq('id', existingRefund.id);
    } else {
      await db().from('refunds').insert({
        roll_order_id: id,
        amount_krw: depositAmount.toString(),
        status: 'REQUESTED',
        reason: 'Force refund from frozen order',
      });
    }

    await auditLog(admin.id, 'roll_force_refund', { type: 'roll_order', id }, null, null);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
