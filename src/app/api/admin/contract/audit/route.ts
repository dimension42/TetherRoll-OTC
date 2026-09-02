import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** POST /api/admin/contract/audit — { chainId, action, txHash, after } */
export async function POST(req: Request) {
  try {
    const admin = await requireRole('admin');
    const { chainId, action, txHash, after } = await req.json();
    if (!chainId || !action || !txHash) {
      return Response.json({ error: 'chainId, action, txHash required' }, { status: 400 });
    }

    const client = db();
    await client.from('onchain_txs').insert({
      user_id: admin.id,
      chain_id: chainId,
      hash: txHash,
      kind: 'contract_admin',
      status: 'CONFIRMED',
    });

    await auditLog(
      admin.id,
      `contract_${action}`,
      { type: 'contract', id: `${chainId}` },
      null,
      { chainId, txHash, ...after }
    );

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
