import { NextResponse } from 'next/server';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { db } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: { id: string; fillId: string } }) {
  try {
    const admin = await requireRole('ops');
    const { fillId } = params;

    const { data: fill } = await db()
      .from('roll_fills')
      .select('*')
      .eq('id', fillId)
      .maybeSingle();

    if (!fill) throw new AuthError(404, 'Fill not found');

    await db()
      .from('roll_fills')
      .update({ status: 'FAILED' })
      .eq('id', fillId);

    await auditLog(admin.id, 'roll_fill_fail', { type: 'roll_fill', id: fillId }, null, null);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
