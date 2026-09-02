import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';
import { isAddress } from 'viem';

export const dynamic = 'force-dynamic';

/** GET /api/admin/whitelist */
export async function GET() {
  try {
    await requireRole('viewer');
    const { data, error } = await db().from('whitelist_addresses').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return Response.json({ whitelist: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/admin/whitelist — { address, label, chainId? } */
export async function POST(req: Request) {
  try {
    const admin = await requireRole('admin');
    const { address, label, chainId } = await req.json();
    if (!address || !label) {
      return Response.json({ error: 'address and label required' }, { status: 400 });
    }
    if (!isAddress(address)) {
      return Response.json({ error: 'Invalid EVM address' }, { status: 400 });
    }

    const client = db();
    const { data, error } = await client.from('whitelist_addresses').insert({
      address: address.toLowerCase(),
      label,
      chain_id: chainId || null,
      created_by: admin.id,
    }).select().single();
    if (error) throw error;

    await auditLog(admin.id, 'whitelist_add', { type: 'whitelist_address', id: data.id }, null, { address, label, chainId });

    return Response.json({ whitelist: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/admin/whitelist — { id } */
export async function DELETE(req: Request) {
  try {
    const admin = await requireRole('admin');
    const { id } = await req.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    const client = db();
    const { data: entry } = await client.from('whitelist_addresses').select('*').eq('id', id).maybeSingle();
    if (!entry) return Response.json({ error: 'Not found' }, { status: 404 });

    await client.from('whitelist_addresses').delete().eq('id', id);
    await auditLog(admin.id, 'whitelist_remove', { type: 'whitelist_address', id }, entry, null);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
