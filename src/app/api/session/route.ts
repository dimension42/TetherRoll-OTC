import { NextResponse, type NextRequest } from 'next/server';
import { checkAllowlist } from '@/lib/auth/allowlist';
import {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  signSession,
  verifySession,
} from '@/lib/auth/session';

export const runtime = 'nodejs';

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** 로그인 직후 클라이언트가 신원을 보내 allowlist 검증 → 세션 쿠키 발급 (D5) */
export async function POST(req: NextRequest) {
  let body: { email?: string | null; wallet?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Bad request' }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim() || undefined;
  const wallet = body.wallet?.toLowerCase().trim() || undefined;
  if (!email && !wallet) {
    return NextResponse.json({ ok: false, message: '신원 정보가 없습니다.' }, { status: 400 });
  }

  const result = await checkAllowlist({ email, wallet });

  // Supabase 미설정 → 개발 모드: allowlist 미강제 (로그인 게이트는 유지)
  if (result.ok === 'unconfigured') {
    const devAdmin = process.env.DEV_ADMIN_EMAIL?.toLowerCase();
    const role = devAdmin && email === devAdmin ? 'admin' : 'user';
    const token = await signSession({ sub: email || wallet!, email, wallet, role });
    const res = NextResponse.json({ ok: true, role, dev: true });
    res.cookies.set(SESSION_COOKIE, token, { ...cookieOpts(), maxAge: SESSION_TTL_SEC });
    return res;
  }

  if (result.ok === true) {
    const acc = result.account;
    const token = await signSession({
      sub: acc.id,
      email: acc.email || undefined,
      wallet: acc.wallet || undefined,
      role: acc.role,
    });
    const res = NextResponse.json({ ok: true, role: acc.role });
    res.cookies.set(SESSION_COOKIE, token, { ...cookieOpts(), maxAge: SESSION_TTL_SEC });
    return res;
  }

  const message =
    result.reason === 'disabled'
      ? '비활성화된 계정입니다. 관리자에게 문의하세요.'
      : '접근 권한이 없는 계정입니다. 회원가입은 불가하며 관리자가 발급한 계정만 이용할 수 있습니다.';
  return NextResponse.json({ ok: false, reason: result.reason, message }, { status: 403 });
}

/** 현재 세션 조회 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    email: session.email,
    wallet: session.wallet,
  });
}

/** 로그아웃 — 세션 쿠키 제거 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...cookieOpts(), maxAge: 0 });
  return res;
}
