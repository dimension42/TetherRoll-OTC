import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { parseBody } from '@/lib/roll/http';
import { db } from '@/lib/db';
import { notifyDepositConfirmed } from '@/lib/roll/notify';

export const dynamic = 'force-dynamic';

const schema = z.object({
  amountKrw: z.number().positive(),
  depositorName: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;
    const body = await parseBody(req, schema);

    const { data: order } = await db()
      .from('roll_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    if (order.status !== 'AWAITING_DEPOSIT') {
      throw new AuthError(400, 'Order is not awaiting deposit');
    }

    // Check if amount matches expected
    const expectedAmount = parseFloat(order.est_fee_platform) + parseFloat(order.est_fee_gas) + parseFloat(order.amount_krw);
    const mismatch = Math.abs(body.amountKrw - expectedAmount) > 1; // allow 1 KRW tolerance

    // Update order
    await db()
      .from('roll_orders')
      .update({
        status: 'FILLING',
        deposit_amount_krw: body.amountKrw.toString(),
        depositor_name: body.depositorName,
        deposit_confirmed_at: new Date().toISOString(),
      })
      .eq('id', id);

    // If mismatch, flag user
    if (mismatch) {
      const { data: user } = await db().from('users').select('risk_flags').eq('id', order.user_id).maybeSingle();
      if (user) {
        const flags = (user.risk_flags as string[]) ?? [];
        if (!flags.includes('deposit_mismatch')) {
          await db()
            .from('users')
            .update({ risk_flags: [...flags, 'deposit_mismatch'] })
            .eq('id', order.user_id);
        }
      }
    }

    await auditLog(admin.id, 'roll_deposit_confirm', { type: 'roll_order', id }, null, {
      amountKrw: body.amountKrw,
      depositorName: body.depositorName,
    });

    await notifyDepositConfirmed(id, body.amountKrw);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
