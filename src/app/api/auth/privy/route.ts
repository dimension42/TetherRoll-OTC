import { createSession } from '@/lib/auth/session';
import { upsertUserByPrivy, assertNotBanned } from '@/lib/auth/link';
import { handleApiError } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/privy — { token } (Privy access token)
 * Privy 소셜 로그인 후 클라이언트가 access token을 보내면 서버에서 검증하고 세션 발급.
 * B-05: embedded wallet과 linked wallets를 user_wallets에 저장.
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

    // B-05: embedded wallet 저장
    const embeddedWallet = user.wallet?.address;
    if (embeddedWallet) {
      const addrLower = embeddedWallet.toLowerCase();
      await db()
        .from('user_wallets')
        .upsert(
          {
            user_id: userId,
            address: addrLower,
            source: 'privy_embedded',
            verified_at: new Date().toISOString(),
            is_primary: false,
          },
          { onConflict: 'address', ignoreDuplicates: true }
        );

      // users.wallet_address가 null이면 설정
      await db()
        .from('users')
        .update({ wallet_address: addrLower })
        .eq('id', userId)
        .is('wallet_address', null);
    }

    // linked wallets (external)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkedWallets = user.linkedAccounts?.filter((acc: any) => acc.type === 'wallet') ?? [];
    for (const w of linkedWallets) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((w as any).address) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addr = (w as any).address.toLowerCase();
        await db()
          .from('user_wallets')
          .upsert(
            {
              user_id: userId,
              address: addr,
              source: 'siwe',
              verified_at: new Date().toISOString(),
              is_primary: false,
            },
            { onConflict: 'address', ignoreDuplicates: true }
          );
      }
    }

    // session_version 조회
    const { data: userRow } = await db().from('users').select('session_version').eq('id', userId).single();
    await createSession(userId, userRow?.session_version ?? 1);

    return Response.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 403) return Response.json({ error: (e as Error).message }, { status: 403 });
    return handleApiError(e);
  }
}
