import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError, auditLog } from '@/lib/auth/guards';
import { parseBody } from '@/lib/validate';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/custody/legs/[id]/fail — fail leg (ops)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;

    const schema = z.object({
      note: z.string().min(1),
    });

    const body = await parseBody(req, schema);

    // Get leg
    const { data: leg, error: fetchErr } = await db()
      .from('custody_legs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!leg) return Response.json({ error: 'Leg not found' }, { status: 404 });

    // Update leg
    const { data: updated, error: updateErr } = await db()
      .from('custody_legs')
      .update({
        status: 'FAILED',
        note: body.note,
        verified_by: admin.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await auditLog(admin.id, 'custody_leg.fail', { type: 'custody_leg', id }, leg, updated);

    return Response.json({ leg: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
