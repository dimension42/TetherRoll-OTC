import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

/**
 * DELETE /api/wallets/[address] — 지갑 연결 해제.
 * 마지막 지갑이면 불가 (최소 1개 유지).
 */
export async function DELETE(_req: Request, { params }: { params: { address: string } }) {
  try {
    const user = await requireUser();
    const { address } = params;
    const addressLower = address.toLowerCase();

    // 내 지갑인지 확인
    const { data: wallet } = await db()
      .from('user_wallets')
      .select('id')
      .eq('user_id', user.id)
      .eq('address', addressLower)
      .maybeSingle();

    if (!wallet) throw new AuthError(404, 'Wallet not found');

    // 전체 지갑 개수 확인
    const { count } = await db()
      .from('user_wallets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count ?? 0) <= 1) {
      throw new AuthError(400, 'Cannot remove last wallet');
    }

    // 삭제
    await db().from('user_wallets').delete().eq('id', wallet.id);

    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
