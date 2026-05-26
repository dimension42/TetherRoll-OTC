'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/**
 * 로그인 상태를 서버 세션 쿠키와 동기화한다 (D5).
 * - 로그인 시: 신원을 /api/session 으로 보내 allowlist 검증 → 쿠키 발급.
 *   미허용이면 강제 로그아웃 후 /login 으로 이동.
 * - 로그아웃 시: 쿠키 제거 후 /login 으로 이동.
 * - /login 페이지는 자체 처리하므로 여기서는 건너뛴다.
 */
export default function SessionSync() {
  const { authenticated, user, logout } = useAuth();
  const pathname = usePathname();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === '/login') return;

    const email = user?.email?.address || user?.google?.email || null;
    const wallet = user?.wallet?.address || null;

    if (authenticated && (email || wallet)) {
      const key = `${email || ''}|${wallet || ''}`;
      if (lastKey.current === key) return;
      lastKey.current = key;
      fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, wallet }),
      })
        .then(async (r) => {
          if (!r.ok) {
            lastKey.current = null;
            await logout();
            window.location.href = '/login';
          }
        })
        .catch(() => {
          lastKey.current = null;
        });
    } else if (!authenticated && lastKey.current !== null) {
      lastKey.current = null;
      fetch('/api/session', { method: 'DELETE' }).catch(() => {});
      window.location.href = '/login';
    }
  }, [authenticated, user, logout, pathname]);

  return null;
}
