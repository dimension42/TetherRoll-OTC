'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount, useConnect, useSignMessage, useChainId } from 'wagmi';
import { createSiweMessage } from 'viem/siwe';
import { usePrivy, useLogin } from '@privy-io/react-auth';
import { useAuth } from '@/hooks/useAuth';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const next = searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const done = async () => {
    await refresh();
    router.push(safeNext);
  };

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setBusy('email');
    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed'); return; }
      if (data.needsConfirmation) { setNotice('확인 메일을 보냈습니다. 메일 인증 후 로그인해주세요.'); return; }
      await done();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 flex justify-center" style={{ background: '#050806' }}>
      <div className="w-full max-w-md px-4">
        <h1 className="text-3xl font-black text-white mb-1">Sign In</h1>
        <p className="text-sm mb-8" style={{ color: '#8FA398' }}>지갑, 이메일, 소셜 — 어떤 방법이든 하나의 계정으로 연결됩니다.</p>

        <WalletLogin onDone={done} busy={busy} setBusy={setBusy} setError={setError} />

        {PRIVY_APP_ID && <SocialLogin onDone={done} busy={busy} setBusy={setBusy} setError={setError} />}

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-xs" style={{ color: '#555' }}>OR EMAIL</span>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <form onSubmit={submitEmail} className="space-y-3">
          <input
            className="input-dark w-full" type="email" placeholder="Email" required
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <input
            className="input-dark w-full" type="password" placeholder="Password (min 8 chars)" required minLength={8}
            value={password} onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy !== null} className="btn-primary w-full py-3">
            {busy === 'email' ? '…' : mode === 'login' ? 'Sign In with Email' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
          className="mt-4 text-sm w-full text-center"
          style={{ color: '#00c9a7' }}
        >
          {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>

        {error && <p className="mt-4 text-sm text-center" style={{ color: '#FF4D5E' }}>{error}</p>}
        {notice && <p className="mt-4 text-sm text-center" style={{ color: '#00c9a7' }}>{notice}</p>}
      </div>
    </div>
  );
}

function WalletLogin({ onDone, busy, setBusy, setError }: {
  onDone: () => Promise<void>;
  busy: string | null;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();

  async function siweLogin(connectorId?: string) {
    setError(null); setBusy('wallet');
    try {
      let account = address;
      if (!isConnected) {
        const connector = connectors.find(c => c.id === connectorId) ?? connectors[0];
        if (!connector) { setError('사용 가능한 지갑이 없습니다'); return; }
        const result = await connectAsync({ connector });
        account = result.accounts[0];
      }
      if (!account) { setError('지갑 연결 실패'); return; }

      const { nonce } = await (await fetch('/api/auth/siwe/nonce')).json();
      const message = createSiweMessage({
        address: account,
        chainId: chainId || 1,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: '1',
        statement: 'Sign in to TetherRoll',
      });
      const signature = await signMessageAsync({ message, account });

      const res = await fetch('/api/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Wallet sign-in failed'); return; }
      await onDone();
    } catch (e) {
      setError((e as Error).message?.slice(0, 120) ?? 'Wallet error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {connectors.map(c => (
        <button
          key={c.id}
          onClick={() => siweLogin(c.id)}
          disabled={busy !== null}
          className="w-full p-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all hover:scale-[1.01]"
          style={{ background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.25)', color: '#00c9a7' }}
        >
          {busy === 'wallet' ? 'Signing…' : `Connect ${c.name}`}
        </button>
      ))}
    </div>
  );
}

function SocialLogin({ onDone, busy, setBusy, setError }: {
  onDone: () => Promise<void>;
  busy: string | null;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
}) {
  const { authenticated, getAccessToken } = usePrivy();
  const [tokenExchanged, setTokenExchanged] = useState(false);

  // F-03 fix: useLogin with onComplete auto-exchanges token
  const { login } = useLogin({
    onComplete: async () => {
      if (tokenExchanged) return; // prevent double-exchange
      setBusy('social');
      setTokenExchanged(true);
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/auth/privy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Social sign-in failed'); return; }
        await onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Social sign-in failed');
      } finally {
        setBusy(null);
      }
    },
  });

  // Auto-exchange if already authenticated (page refresh case)
  useEffect(() => {
    if (authenticated && !tokenExchanged && busy !== 'social') {
      (async () => {
        setBusy('social');
        setTokenExchanged(true);
        try {
          const token = await getAccessToken();
          const res = await fetch('/api/auth/privy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (!res.ok) { setError(data.error ?? 'Social sign-in failed'); return; }
          await onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Social sign-in failed');
        } finally {
          setBusy(null);
        }
      })();
    }
  }, [authenticated, tokenExchanged, busy, getAccessToken, setBusy, setError, onDone]);

  return (
    <button
      onClick={login}
      disabled={busy !== null}
      className="w-full mt-2 p-3.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.01]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#F2F5F3' }}
    >
      {busy === 'social' ? 'Signing in…' : 'Continue with Google / X / Telegram'}
    </button>
  );
}
