import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** POST /api/admin/disputes/[id]/resolve-tx — { txHash } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { txHash } = await req.json();
    const id = params.id;
    if (!txHash?.trim()) return Response.json({ error: 'txHash required' }, { status: 400 });

    const client = db();
    const { data: dispute } = await client
      .from('disputes')
      .select('*, trade:trade_id (id, chain_id)')
      .eq('id', id)
      .maybeSingle();
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });
    if (!dispute.status.startsWith('RESOLVED_')) {
      return Response.json({ error: 'Dispute must have decision recorded first' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await client.from('disputes').update({
      resolve_tx_hash: txHash.trim(),
      resolved_by: admin.id,
      resolved_at: now,
    }).eq('id', id);

    await client.from('trades').update({ status: 'RESOLVED', updated_at: now }).eq('id', dispute.trade_id);

    await client.from('onchain_txs').insert({
      user_id: admin.id,
      chain_id: (dispute.trade as { chain_id: number }).chain_id,
      hash: txHash.trim(),
      kind: 'fiat_resolve',
      ref_type: 'dispute',
      ref_id: id,
      status: 'CONFIRMED',
    });

    await auditLog(admin.id, 'dispute_resolve_tx', { type: 'dispute', id }, { status: dispute.status }, { txHash, resolved: true });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
