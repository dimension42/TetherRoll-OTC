import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { parseBody } from '@/lib/roll/http';
import { db } from '@/lib/db';

const schema = z.object({
  enabled: z.boolean().optional(),
  feeOverrideBps: z.number().int().min(0).max(1000).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('admin');
    const { id } = params;
    const body = await parseBody(req, schema);

    const { data: venue } = await db()
      .from('venues')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!venue) throw new AuthError(404, 'Venue not found');

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.feeOverrideBps !== undefined) updates.fee_override_bps = body.feeOverrideBps;

    await db().from('venues').update(updates).eq('id', id);

    await auditLog(admin.id, 'venue_update', { type: 'venue', id }, venue, updates);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
