import { NextResponse } from 'next/server';
import { handleApiError, AuthError, auditLog } from '@/lib/auth/guards';
import { requireRole } from '@/lib/auth/adminRoles';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/roll/crypto';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole('ops');
    const { id } = params;

    const { data: refund } = await db()
      .from('refunds')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!refund) throw new AuthError(404, 'Refund not found');

    if (!refund.bank_info_enc) {
      return NextResponse.json({ error: 'No bank info provided' }, { status: 404 });
    }

    const decrypted = decrypt(refund.bank_info_enc);
    const bankInfo = JSON.parse(decrypted);

    await auditLog(admin.id, 'refund_bank_decrypt', { type: 'refund', id }, null, null);

    return NextResponse.json({ bankInfo });
  } catch (e) {
    return handleApiError(e);
  }
}
