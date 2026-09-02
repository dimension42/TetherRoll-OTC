import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';

/** GET /api/admin/disputes/[id] — detail with evidence signed URLs */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole('viewer');
    const id = params.id;

    const client = db();
    const { data: dispute } = await client
      .from('disputes')
      .select(`
        *,
        trade:trade_id (
          id, kind, chain_id, onchain_trade_id,
          seller:seller_id (id, email, wallet_address, display_name),
          buyer:buyer_id (id, email, wallet_address, display_name)
        )
      `)
      .eq('id', id)
      .maybeSingle();
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });

    // Generate signed URLs for evidence
    const evidencePaths = dispute.evidence_paths || [];
    const evidenceUrls = await Promise.all(
      evidencePaths.map(async (path: string) => {
        const { data } = await client.storage.from('evidence').createSignedUrl(path, 600);
        return { path, url: data?.signedUrl };
      })
    );

    return Response.json({ dispute: { ...dispute, evidenceUrls } });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/admin/disputes/[id]/decision — { decision: 'buyer' | 'seller', note } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { decision, note } = await req.json();
    const id = params.id;
    if (!['buyer', 'seller'].includes(decision)) {
      return Response.json({ error: 'decision must be buyer or seller' }, { status: 400 });
    }

    const client = db();
    const { data: dispute } = await client.from('disputes').select('*').eq('id', id).maybeSingle();
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });
    if (dispute.status !== 'OPEN') {
      return Response.json({ error: 'Dispute not OPEN' }, { status: 400 });
    }

    const newStatus = decision === 'buyer' ? 'RESOLVED_BUYER' : 'RESOLVED_SELLER';
    await client.from('disputes').update({
      status: newStatus,
      decision_note: note || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await auditLog(admin.id, 'dispute_decision', { type: 'dispute', id }, { status: 'OPEN' }, { status: newStatus, decision, note });

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
