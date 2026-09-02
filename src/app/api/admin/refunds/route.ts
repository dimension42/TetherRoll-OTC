import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { parseBody } from '@/lib/roll/http';
import { db } from '@/lib/db';

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PROCESSING', 'DONE', 'FAILED']),
  note: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    await requireRole('ops');

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    let query = db()
      .from('refunds')
      .select(`
        *,
        roll_orders!refunds_roll_order_id_fkey(
          id,
          user_id,
          users!roll_orders_user_id_fkey(email, wallet_address, display_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query;

    return NextResponse.json({ refunds: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole('ops');
    const body = await parseBody(req, updateSchema);

    const { data: refund } = await db()
      .from('refunds')
      .select('*')
      .eq('id', body.id)
      .maybeSingle();

    if (!refund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { status: body.status };
    if (body.note) updates.note = body.note;
    if (body.status === 'DONE') {
      updates.processed_by = admin.id;
      updates.processed_at = new Date().toISOString();
    }

    await db().from('refunds').update(updates).eq('id', body.id);

    await auditLog(admin.id, 'refund_update', { type: 'refund', id: body.id }, refund, updates);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
