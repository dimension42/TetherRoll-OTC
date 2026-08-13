import { createSession } from '@/lib/auth/session';
import { upsertUserByPrivy, assertNotBanned } from '@/lib/auth/link';
import { handleApiError } from '@/lib/auth/guards';

/**
 * POST /api/auth/privy — { token } (Privy access token)
 * Privy 소셜 로그인 후 클라이언트가 access token을 보내면 서버에서 검증하고 세션 발급.
 * PRIVY_APP_SECRET 미설정 시 비활성.
 */
export async function POST(req: Request) {
  try {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const secret = process.env.PRIVY_APP_SECRET;
    if (!appId || !secret) {
      return Response.json({ error: 'Social login not configured' }, { status: 501 });
    }

    const { token } = await req.json();
    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

    const { PrivyClient } = await import('@privy-io/server-auth');
    const privy = new PrivyClient(appId, secret);
    const claims = await privy.verifyAuthToken(token);

    const user = await privy.getUser(claims.userId);
    const email = user.email?.address ?? user.google?.email ?? null;

    const userId = await upsertUserByPrivy(claims.userId, email);
    await assertNotBanned(userId);
    await createSession(userId);
    return Response.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 403) return Response.json({ error: (e as Error).message }, { status: 403 });
    return handleApiError(e);
  }
}
