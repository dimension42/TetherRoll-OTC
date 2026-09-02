import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { auditLog, handleApiError } from '@/lib/auth/guards';
import { isAddress } from 'viem';

/** GET /api/admin/treasury/transfers */
export async function GET() {
  try {
    await requireRole('viewer');
    const { data, error } = await db()
      .from('treasury_transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return Response.json({ transfers: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/admin/treasury/transfers — { chainId, fromWallet, toAddress, token, amount, note } */
export async function POST(req: Request) {
  try {
    const admin = await requireRole('admin');
    const { chainId, fromWallet, toAddress, token, amount, note } = await req.json();
    if (!chainId || !fromWallet || !toAddress || !token || !amount) {
      return Response.json({ error: 'chainId, fromWallet, toAddress, token, amount required' }, { status: 400 });
    }
    if (!isAddress(toAddress)) {
      return Response.json({ error: 'Invalid toAddress' }, { status: 400 });
    }

    const client = db();
    // Check whitelist
    const { data: whitelisted } = await client
      .from('whitelist_addresses')
      .select('id')
      .eq('address', toAddress.toLowerCase())
      .or(`chain_id.is.null,chain_id.eq.${chainId}`)
      .maybeSingle();
    if (!whitelisted) {
      return Response.json({ error: 'toAddress not whitelisted for this chain' }, { status: 400 });
    }

    const { data, error } = await client.from('treasury_transfers').insert({
      chain_id: chainId,
      from_wallet: fromWallet,
      to_address: toAddress.toLowerCase(),
      token,
      amount,
      note,
      status: 'REQUESTED',
      requested_by: admin.id,
    }).select().single();
    if (error) throw error;

    await auditLog(admin.id, 'treasury_transfer_request', { type: 'treasury_transfer', id: data.id }, null, { chainId, toAddress, amount, token });

    return Response.json({ transfer: data });
  } catch (e) {
    return handleApiError(e);
  }
}
