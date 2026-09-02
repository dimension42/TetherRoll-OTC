'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { WagmiProvider as BaseWagmiProvider } from 'wagmi';
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { AuthContext, type AuthState, type SessionUser } from '@/hooks/useAuth';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * 세션 기반 인증 프로바이더.
 * 서버 발급 httpOnly 쿠키(tr_session)가 유일한 신원 소스 — 클라이언트 저장소에 계정 정보를 두지 않는다.
 * SessionUser에 wallets[] 추가 (WS3 요구사항)
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
    const current = window.location.pathname;
    const next = current !== '/' && !current.startsWith('/login') ? current : '';
    window.location.href = `/login${next ? `?next=${encodeURIComponent(next)}` : ''}`;
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
  // F-05 수정: SSR은 항상 렌더링, 클라이언트 전용 위젯만 mounted 가드
  const app = <AuthProvider>{children}</AuthProvider>;

  // Privy 임베디드 지갑을 wagmi에 연결
  const WagmiProvider = PRIVY_APP_ID ? PrivyWagmiProvider : BaseWagmiProvider;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {PRIVY_APP_ID ? (
          <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
              appearance: { theme: 'dark', accentColor: '#00c9a7' },
              loginMethods: ['email', 'google', 'twitter', 'telegram'],
              // 소셜 유저도 온체인 주체를 갖도록 임베디드 지갑 자동 생성 (서버가 user_wallets 에 연결)
              embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
            }}
          >
            {WALLETCONNECT_PROJECT_ID ? (
              <RainbowKitProvider
                theme={darkTheme({
                  accentColor: '#00c9a7',
                  accentColorForeground: '#000',
                  borderRadius: 'medium',
                })}
              >
                {app}
              </RainbowKitProvider>
            ) : (
              app
            )}
          </PrivyProvider>
        ) : WALLETCONNECT_PROJECT_ID ? (
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: '#00c9a7',
              accentColorForeground: '#000',
              borderRadius: 'medium',
            })}
          >
            {app}
          </RainbowKitProvider>
        ) : (
          app
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
