import { NextResponse } from 'next/server';
import { requireAdmin, handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { computeSettlement } from '@/lib/roll/settle';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const { id } = params;

    const { data: order } = await db()
      .from('roll_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    if (order.status !== 'FILLING') {
      throw new AuthError(400, 'Order is not in FILLING status');
    }

    // Fetch fills
    const { data: fills } = await db().from('roll_fills').select('*').eq('roll_order_id', id);

    // Fetch partial discount config
    const { data: feeConfigs } = await db()
      .from('fee_configs')
      .select('*')
      .eq('key', 'partial_discount_pct')
      .order('created_at', { ascending: false })
      .limit(1);
    const partialDiscountPct = parseFloat(feeConfigs?.[0]?.value ?? '90');

    // Compute settlement
    const settlement = computeSettlement({
      amountKrw: parseFloat(order.amount_krw),
      depositAmount: parseFloat(order.deposit_amount_krw ?? order.amount_krw),
      estFeePlatform: parseFloat(order.est_fee_platform),
      estFeeGas: parseFloat(order.est_fee_gas),
      fills: (fills ?? []).map(f => ({
        status: f.status,
        amountKrw: parseFloat(f.amount_krw),
        amountAsset: parseFloat(f.amount_asset),
        gasActual: f.gas_actual ? parseFloat(f.gas_actual) : undefined,
      })),
      minFillPct: order.min_fill_pct,
      partialDiscountPct,
    });

    // Update order
    await db()
      .from('roll_orders')
      .update({
        status: settlement.status,
        filled_krw: settlement.filledKrw.toString(),
        filled_asset: settlement.filledAsset.toString(),
        fee_actual_platform: settlement.feeActualPlatform.toString(),
        fee_actual_gas: settlement.feeActualGas.toString(),
        discount_applied: settlement.discountApplied.toString(),
        refund_krw: settlement.refundKrw.toString(),
        settled_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Create/update refund if needed
    if (settlement.refundKrw > 0) {
      const { data: existingRefund } = await db()
        .from('refunds')
        .select('*')
        .eq('roll_order_id', id)
        .maybeSingle();

      if (existingRefund) {
        await db()
          .from('refunds')
          .update({
            amount_krw: settlement.refundKrw.toString(),
            status: 'REQUESTED',
          })
          .eq('id', existingRefund.id);
      } else {
        await db().from('refunds').insert({
          roll_order_id: id,
          amount_krw: settlement.refundKrw.toString(),
          status: 'REQUESTED',
        });
      }
    }

    await auditLog(admin.id, 'roll_settle', { type: 'roll_order', id }, null, settlement);

    return NextResponse.json({ settlement });
  } catch (e) {
    return handleApiError(e);
  }
}

// Preview endpoint (GET)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const { id } = params;

    const { data: order } = await db()
      .from('roll_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    const { data: fills } = await db().from('roll_fills').select('*').eq('roll_order_id', id);

    const { data: feeConfigs } = await db()
      .from('fee_configs')
      .select('*')
      .eq('key', 'partial_discount_pct')
      .order('created_at', { ascending: false })
      .limit(1);
    const partialDiscountPct = parseFloat(feeConfigs?.[0]?.value ?? '90');

    const settlement = computeSettlement({
      amountKrw: parseFloat(order.amount_krw),
      depositAmount: parseFloat(order.deposit_amount_krw ?? order.amount_krw),
      estFeePlatform: parseFloat(order.est_fee_platform),
      estFeeGas: parseFloat(order.est_fee_gas),
      fills: (fills ?? []).map(f => ({
        status: f.status,
        amountKrw: parseFloat(f.amount_krw),
        amountAsset: parseFloat(f.amount_asset),
        gasActual: f.gas_actual ? parseFloat(f.gas_actual) : undefined,
      })),
      minFillPct: order.min_fill_pct,
      partialDiscountPct,
    });

    return NextResponse.json({ settlement });
  } catch (e) {
    return handleApiError(e);
  }
}
