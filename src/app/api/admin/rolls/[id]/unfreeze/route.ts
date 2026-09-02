import { NextResponse } from 'next/server';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { db } from '@/lib/db';

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
      throw new AuthError(400, 'Order is not frozen');
    }

    await db()
      .from('roll_orders')
      .update({
        status: 'FILLING',
        frozen_by: null,
        frozen_reason: null,
      })
      .eq('id', id);

    await auditLog(admin.id, 'roll_unfreeze', { type: 'roll_order', id }, null, null);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
