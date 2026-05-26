// HMAC 서명된 세션 토큰 (Edge·Node 공통, Web Crypto 사용).
// 로그인 게이팅(D5)용 세션. 서버가 allowlist 검증 후에만 발급한다.
// ⚠️ 프로덕션에서는 SESSION_SECRET 환경변수를 반드시 설정. (미설정 시 개발용 약한 키 사용)

export const SESSION_COOKIE = 'tr_session';
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7일

const encoder = new TextEncoder();

function secret(): string {
  return process.env.SESSION_SECRET || 'dev-insecure-session-secret-change-me';
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(input: string): Uint8Array {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return bytesToB64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SessionPayload = {
  sub: string;        // 식별자(email 또는 wallet)
  email?: string;
  wallet?: string;
  role: string;       // 'admin' | 'maker' | 'taker' | 'user'
  iat: number;
  exp: number;
};

export async function signSession(
  p: Omit<SessionPayload, 'iat' | 'exp'>,
  ttlSec: number = SESSION_TTL_SEC,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { ...p, iat: now, exp: now + ttlSec };
  const body = bytesToB64url(encoder.encode(JSON.stringify(full)));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(body);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
