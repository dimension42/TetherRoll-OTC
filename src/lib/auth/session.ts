import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE = 'tr_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7d

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET not set');
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.uid as string) ?? null;
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
