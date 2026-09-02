import { NextResponse } from 'next/server';
import { handleApiError, AuthError } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('ops');
    const { id } = params;

    const { data: order } = await db()
      .from('roll_orders')
      .select(`
        *,
        users!roll_orders_user_id_fkey(email, wallet_address, display_name)
      `)
      .eq('id', id)
      .maybeSingle();

    if (!order) throw new AuthError(404, 'Order not found');

    const { data: fills } = await db()
      .from('roll_fills')
      .select('*')
      .eq('roll_order_id', id)
      .order('created_at', { ascending: true });

    const { data: refund } = await db()
      .from('refunds')
      .select('*')
      .eq('roll_order_id', id)
      .maybeSingle();

    return NextResponse.json({
      order,
      fills: fills ?? [],
      refund: refund ?? null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
