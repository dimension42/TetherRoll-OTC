import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { parseBody } from '@/lib/roll/http';
import { db } from '@/lib/db';

const schema = z.object({
  venueId: z.string(),
  amountKrw: z.number().positive(),
  amountAsset: z.number().positive(),
  rate: z.number().positive(),
});

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const { id } = params;
    const body = await parseBody(_req, schema);

    const { data: order } = await db()
      .from('roll_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    if (order.status !== 'FILLING') {
      throw new AuthError(400, 'Order is not in FILLING status');
    }

    // Check cumulative filled <= deposit
    const { data: fills } = await db().from('roll_fills').select('*').eq('roll_order_id', id);
    const currentFilled = (fills ?? []).reduce((sum, f) => sum + parseFloat(f.amount_krw), 0);
    const depositAmount = parseFloat(order.deposit_amount_krw ?? order.amount_krw);

    if (currentFilled + body.amountKrw > depositAmount) {
      throw new AuthError(400, 'Cumulative fills exceed deposit amount');
    }

    // Create fill
    const { data: fill } = await db()
      .from('roll_fills')
      .insert({
        roll_order_id: id,
        venue_id: body.venueId,
        amount_krw: body.amountKrw.toString(),
        amount_asset: body.amountAsset.toString(),
        rate: body.rate.toString(),
        status: 'EXECUTED',
        executed_by: admin.id,
      })
      .select('*')
      .single();

    if (!fill) throw new Error('Failed to create fill');

    // Update order filled amounts
    const newFilledKrw = currentFilled + body.amountKrw;
    const currentFilledAsset = (fills ?? []).reduce((sum, f) => sum + parseFloat(f.amount_asset), 0);
    const newFilledAsset = currentFilledAsset + body.amountAsset;

    await db()
      .from('roll_orders')
      .update({
        filled_krw: newFilledKrw.toString(),
        filled_asset: newFilledAsset.toString(),
      })
      .eq('id', id);

    await auditLog(admin.id, 'roll_fill_create', { type: 'roll_order', id }, null, body);

    return NextResponse.json({ fill });
  } catch (e) {
    return handleApiError(e);
  }
}
