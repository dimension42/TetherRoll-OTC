'use client';

import { useState, useEffect } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { PRIVY_APP_ID } from '@/lib/privy';
import { AuthContext, type AuthState } from '@/hooks/useAuth';

const queryClient = new QueryClient();
const hasValidPrivyId = PRIVY_APP_ID && PRIVY_APP_ID !== 'PRIVY_APP_ID_HERE';

const defaultAuth: AuthState = {
  ready: true,
  authenticated: false,
  login: () => {},
  logout: async () => {},
  user: null,
  wallets: [],
};

function PrivyAuthBridge({ children }: { children: React.ReactNode }) {
  const [mod, setMod] = useState<any>(null);

  useEffect(() => {
    if (hasValidPrivyId) {
      import('@privy-io/react-auth').then(setMod);
    }
  }, []);

  if (!hasValidPrivyId || !mod) {
    return (
      <AuthContext.Provider value={defaultAuth}>
        {children}
      </AuthContext.Provider>
    );
  }

  const { PrivyProvider } = mod;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark' as const,
          accentColor: '#00c9a7',
        },
        loginMethods: ['email', 'google', 'twitter', 'telegram', 'wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <PrivyAuthSync>{children}</PrivyAuthSync>
    </PrivyProvider>
  );
}

function PrivyAuthSync({ children }: { children: React.ReactNode }) {
  const [privyMod, setPrivyMod] = useState<any>(null);

  useEffect(() => {
    import('@privy-io/react-auth').then(setPrivyMod);
  }, []);

  if (!privyMod) {
    return <AuthContext.Provider value={defaultAuth}>{children}</AuthContext.Provider>;
  }

  return <PrivyAuthSyncInner mod={privyMod}>{children}</PrivyAuthSyncInner>;
}

function PrivyAuthSyncInner({ children, mod }: { children: React.ReactNode; mod: any }) {
  const { usePrivy, useWallets } = mod;
  const privy = usePrivy();
  const { wallets } = useWallets();

  const auth: AuthState = {
    ready: privy.ready,
    authenticated: privy.authenticated,
    login: privy.login,
    logout: privy.logout,
    user: privy.user,
    wallets: wallets || [],
  };

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <PrivyAuthBridge>
          {mounted ? children : null}
        </PrivyAuthBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
