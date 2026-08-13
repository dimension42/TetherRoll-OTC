import { getSessionUser } from '@/lib/auth/guards';

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
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      walletAddress: user.wallet_address,
      displayName: user.display_name,
      vipStatus: user.vip_status,
      // 메뉴 노출용 boolean만 노출. 실제 권한은 항상 서버 가드가 판별.
      isAdmin: user.role === 'admin' || isEnvAdmin(user.email),
    },
  });
}
