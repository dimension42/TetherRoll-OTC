import { getSessionUser } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function isEnvAdmin(email: string | null): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/** GET /api/auth/me — 현재 세션 유저 (비로그인 시 user: null) */
export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ user: null });

  // 지갑 목록 조회
  const { data: wallets } = await db()
    .from('user_wallets')
    .select('address, source, is_primary')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const primary = wallets?.find(w => w.is_primary)?.address ?? wallets?.[0]?.address ?? null;

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      walletAddress: primary,
      wallets: wallets?.map(w => ({ address: w.address, source: w.source, isPrimary: w.is_primary })) ?? [],
      displayName: user.display_name,
      vipStatus: user.vip_status,
      isAdmin: user.role === 'admin' || isEnvAdmin(user.email),
    },
  });
}
