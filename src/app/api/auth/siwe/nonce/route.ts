import { generateSiweNonce } from 'viem/siwe';
import { cookies } from 'next/headers';

/** GET /api/auth/siwe/nonce — SIWE nonce 발급 (5분 유효, httpOnly) */
export async function GET() {
  const nonce = generateSiweNonce();
  cookies().set('tr_siwe_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });
  return Response.json({ nonce });
}
