import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

// 로그인 우선(D5): 유효한 세션 쿠키가 없으면 모든 페이지를 /login 으로 리다이렉트.
// /api/* 는 각 라우트가 자체 인증 처리(여기서 리다이렉트하면 fetch가 깨짐) → 통과.
const ASSET_RE = /\.(svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|css|js|map)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    ASSET_RE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
