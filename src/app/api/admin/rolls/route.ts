import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    await requireRole('ops');

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    let query = db()
      .from('roll_orders')
      .select(`
        *,
        users!roll_orders_user_id_fkey(email, wallet_address, display_name)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query;

    return NextResponse.json({ orders: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
