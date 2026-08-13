'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { config } from '@/lib/wagmi';
import { AuthContext, type AuthState, type SessionUser } from '@/hooks/useAuth';

const queryClient = new QueryClient();
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * 세션 기반 인증 프로바이더.
 * 서버 발급 httpOnly 쿠키(tr_session)가 유일한 신원 소스 — 클라이언트 저장소에 계정 정보를 두지 않는다.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/';
  }, []);

  const auth: AuthState = { ready, authenticated: !!user, user, login, logout, refresh };

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export default function Web3Provider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const app = <AuthProvider>{mounted ? children : null}</AuthProvider>;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {PRIVY_APP_ID ? (
          <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
              appearance: { theme: 'dark', accentColor: '#00c9a7' },
              loginMethods: ['email', 'google', 'twitter', 'telegram'],
              embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
            }}
          >
            {app}
          </PrivyProvider>
        ) : (
          app
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
