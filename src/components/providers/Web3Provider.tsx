'use client';

import { useState, useEffect, useCallback } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { PRIVY_APP_ID } from '@/lib/privy';
import { AuthContext, type AuthState, type AuthUser } from '@/hooks/useAuth';
import SessionSync from '@/components/auth/SessionSync';

const queryClient = new QueryClient();
const hasValidPrivyId = PRIVY_APP_ID && PRIVY_APP_ID !== 'PRIVY_APP_ID_HERE';

const TEST_ACCOUNTS = {
  admin: {
    wallet: { address: '0xAd00000000000000000000000000000000Admin' },
    email: { address: 'culture@culturing.org' },
    google: undefined,
    twitter: undefined,
    telegram: undefined,
  },
  alice: {
    wallet: { address: '0xA11ce00000000000000000000000000000A11ce' },
    email: { address: 'alice@tetherroll.com' },
    google: { email: 'alice@gmail.com' },
    twitter: undefined,
    telegram: undefined,
  },
  bob: {
    wallet: { address: '0xB0b000000000000000000000000000000000B0b' },
    email: undefined,
    google: undefined,
    twitter: { username: 'bob_trader' },
    telegram: { username: 'bob_otc' },
  },
};

function TestAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('tetherroll_test_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [showModal, setShowModal] = useState(false);

  const login = useCallback(() => setShowModal(true), []);
  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem('tetherroll_test_user');
  }, []);

  const selectAccount = useCallback((account: AuthUser) => {
    setUser(account);
    setShowModal(false);
    localStorage.setItem('tetherroll_test_user', JSON.stringify(account));
  }, []);

  const auth: AuthState = {
    ready: true,
    authenticated: !!user,
    login,
    logout,
    user,
    wallets: user?.wallet ? [{ address: user.wallet.address, walletClientType: 'privy' }] : [],
  };

  return (
    <AuthContext.Provider value={auth}>
      <SessionSync />
      {children}
      {showModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-2xl p-6"
            style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Sign In</h3>
            <p className="text-xs mb-5" style={{ color: '#666' }}>
              Test Mode — Select a demo account
            </p>

            <div className="space-y-2.5">
              {[
                { key: 'admin', label: 'Admin', desc: 'culture@culturing.org', icon: 'A', color: '#ff4466' },
                { key: 'alice', label: 'Alice (Maker)', desc: 'alice@tetherroll.com', icon: 'A', color: '#00c9a7' },
                { key: 'bob', label: 'Bob (Taker)', desc: '@bob_trader', icon: 'B', color: '#6366f1' },
              ].map(acc => (
                <button
                  key={acc.key}
                  onClick={() => selectAccount(TEST_ACCOUNTS[acc.key as keyof typeof TEST_ACCOUNTS])}
                  className="w-full p-3 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: acc.color }}
                  >
                    {acc.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">{acc.label}</p>
                    <p className="text-xs" style={{ color: '#888' }}>{acc.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-center" style={{ color: '#555' }}>
                Set NEXT_PUBLIC_PRIVY_APP_ID to enable real social login
              </p>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

function PrivyAuthBridge({ children }: { children: React.ReactNode }) {
  const [mod, setMod] = useState<any>(null);

  useEffect(() => {
    if (hasValidPrivyId) {
      import('@privy-io/react-auth').then(setMod);
    }
  }, []);

  if (!hasValidPrivyId || !mod) {
    return <TestAuthProvider>{children}</TestAuthProvider>;
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
    return (
      <AuthContext.Provider value={{
        ready: false, authenticated: false, login: () => {}, logout: async () => {}, user: null, wallets: [],
      }}>
        {children}
      </AuthContext.Provider>
    );
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

  return (
    <AuthContext.Provider value={auth}>
      <SessionSync />
      {children}
    </AuthContext.Provider>
  );
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
