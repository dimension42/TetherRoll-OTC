import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { parseBody } from '@/lib/roll/http';
import { db } from '@/lib/db';

const schema = z.object({
  txHash: z.string().min(1),
  gasActual: z.number().nonnegative(),
});

export async function POST(req: Request, { params }: { params: { id: string; fillId: string } }) {
  try {
    const admin = await requireRole('ops');
    const { fillId } = params;
    const body = await parseBody(req, schema);

    const { data: fill } = await db()
      .from('roll_fills')
      .select('*')
      .eq('id', fillId)
      .maybeSingle();

    if (!fill) throw new AuthError(404, 'Fill not found');

    if (fill.status !== 'EXECUTED') {
      throw new AuthError(400, 'Fill is not in EXECUTED status');
    }

    await db()
      .from('roll_fills')
      .update({
        status: 'SENT',
        tx_hash: body.txHash,
        gas_actual: body.gasActual.toString(),
      })
      .eq('id', fillId);

    await auditLog(admin.id, 'roll_fill_sent', { type: 'roll_fill', id: fillId }, null, body);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
