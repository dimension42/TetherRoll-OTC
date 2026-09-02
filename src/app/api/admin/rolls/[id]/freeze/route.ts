import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { parseBody } from '@/lib/roll/http';
import { db } from '@/lib/db';
import { notifyFrozen } from '@/lib/roll/notify';

const schema = z.object({
  reason: z.string().min(1),
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

    await db()
      .from('roll_orders')
      .update({
        status: 'FROZEN',
        frozen_by: admin.id,
        frozen_reason: body.reason,
      })
      .eq('id', id);

    await auditLog(admin.id, 'roll_freeze', { type: 'roll_order', id }, null, { reason: body.reason });
    await notifyFrozen(id, body.reason);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
