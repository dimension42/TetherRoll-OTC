import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** POST /api/admin/treasury/transfers/[id]/executed — { txHash } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('admin');
    const { txHash } = await req.json();
    const id = params.id;
    if (!txHash?.trim()) return Response.json({ error: 'txHash required' }, { status: 400 });

    const client = db();
    const { data: transfer } = await client.from('treasury_transfers').select('*').eq('id', id).maybeSingle();
    if (!transfer) return Response.json({ error: 'Transfer not found' }, { status: 404 });
    if (transfer.status !== 'APPROVED') {
      return Response.json({ error: 'Transfer not APPROVED (cannot execute)' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await client.from('treasury_transfers').update({
      status: 'EXECUTED',
      tx_hash: txHash.trim(),
      executed_at: now,
      updated_at: now,
    }).eq('id', id);

    await client.from('onchain_txs').insert({
      user_id: admin.id,
      chain_id: transfer.chain_id,
      hash: txHash.trim(),
      kind: 'treasury',
      ref_type: 'treasury_transfer',
      ref_id: id,
      status: 'CONFIRMED',
    });

    await auditLog(admin.id, 'treasury_transfer_executed', { type: 'treasury_transfer', id }, { status: 'APPROVED' }, { status: 'EXECUTED', txHash });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
