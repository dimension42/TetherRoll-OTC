import { cookies } from 'next/headers';
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe';
import { createSession } from '@/lib/auth/session';
import { upsertUserByWallet, assertNotBanned } from '@/lib/auth/link';
import { handleApiError, AuthError, getSessionUser } from '@/lib/auth/guards';
import { publicClientFor } from '@/lib/onchain/client';
import { db } from '@/lib/db';
import { rateLimitByIp } from '@/lib/ratelimit';
import { isSupportedChain } from '@/lib/chains';

/**
 * POST /api/auth/siwe/verify — { message, signature }
 * B-03: domain, uri origin, expirationTime/notBefore, chainId 검증 추가.
 * 로그인 세션이 있으면 지갑 연결, 없으면 로그인.
 */
export async function POST(req: Request) {
  try {
    await rateLimitByIp(req, 10, 60); // 10/min per IP

    const { message, signature } = await req.json();
    if (!message || !signature) throw new AuthError(400, 'Missing fields');

    const savedNonce = cookies().get('tr_siwe_nonce')?.value;
    const parsed = parseSiweMessage(message);

    if (!savedNonce || parsed.nonce !== savedNonce) {
      throw new AuthError(401, 'Invalid nonce');
    }

    // B-03: domain 검증
    const expectedDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || req.headers.get('host') || '';
    if (parsed.domain !== expectedDomain) {
      throw new AuthError(401, 'Invalid domain');
    }

    // B-03: uri origin 검증
    const uriOrigin = parsed.uri ? new URL(parsed.uri).origin : '';
    const requestOrigin = req.headers.get('origin') || `https://${expectedDomain}`;
    if (uriOrigin !== requestOrigin) {
      throw new AuthError(401, 'Invalid URI origin');
    }

    // B-03: expirationTime / notBefore 검증
    const now = new Date();
    if (parsed.expirationTime && new Date(parsed.expirationTime) < now) {
      throw new AuthError(401, 'Message expired');
    }
    if (parsed.notBefore && new Date(parsed.notBefore) > now) {
      throw new AuthError(401, 'Message not yet valid');
    }

    // B-03: chainId 검증 (지원 체인)
    const chainId = parsed.chainId ?? 1;
    if (!isSupportedChain(chainId)) {
      throw new AuthError(400, 'Unsupported chainId');
    }

    // B-03: 메시지의 chainId로 public client 생성
    const client = publicClientFor(chainId);
    const valid = await verifySiweMessage(client, { message, signature });
    if (!valid || !parsed.address) {
      throw new AuthError(401, 'Invalid signature');
    }

    cookies().set('tr_siwe_nonce', '', { httpOnly: true, path: '/', maxAge: 0 });

    const addressLower = parsed.address.toLowerCase();

    // 기존 로그인 세션이 있으면 지갑 연결 모드
    const existingUser = await getSessionUser().catch(() => null);
    if (existingUser) {
      // 지갑 연결
      const { data: existingWallet } = await db()
        .from('user_wallets')
        .select('user_id')
        .eq('address', addressLower)
        .maybeSingle();

      if (existingWallet && existingWallet.user_id !== existingUser.id) {
        throw new AuthError(409, 'Wallet already linked to another account');
      }

      if (!existingWallet) {
        await db().from('user_wallets').insert({
          user_id: existingUser.id,
          address: addressLower,
          source: 'siwe',
          verified_at: new Date().toISOString(),
          is_primary: false,
        });
      }

      return Response.json({ ok: true, address: addressLower, linked: true });
    }

    // 로그인 모드
    const userId = await upsertUserByWallet(addressLower);
    await assertNotBanned(userId);

    // session_version 조회
    const { data: userRow } = await db().from('users').select('session_version').eq('id', userId).single();
    await createSession(userId, userRow?.session_version ?? 1);

    return Response.json({ ok: true, address: addressLower });
  } catch (e) {
    return handleApiError(e);
  }
}
