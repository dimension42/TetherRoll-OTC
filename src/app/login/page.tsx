'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  // open-redirect 방지: 내부 절대경로만 허용
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

function LoginInner() {
  const { login, logout, authenticated, user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [phase, setPhase] = useState<'idle' | 'checking' | 'denied'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!authenticated || !user) return;
    const email = user.email?.address || user.google?.email || null;
    const wallet = user.wallet?.address || null;
    setPhase('checking');
    fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, wallet }),
    })
      .then(async (r) => {
        if (r.ok) {
          router.replace(next);
        } else {
          const d = await r.json().catch(() => ({}));
          setMsg(d.message || '접근 권한이 없는 계정입니다.');
          setPhase('denied');
          await logout();
        }
      })
      .catch(() => {
        setMsg('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
        setPhase('denied');
      });
  }, [authenticated, user, next, router, logout]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080808' }}>
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-2xl font-black text-black mb-4"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
          >
            ₮
          </div>
          <h1 className="text-2xl font-black text-white">TetherRoll</h1>
          <p className="text-sm mt-1" style={{ color: '#666' }}>Secure OTC Trading</p>
        </div>

        {phase === 'checking' ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div
              className="w-7 h-7 border-2 rounded-full animate-spin"
              style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: '#888' }}>계정 확인 중…</p>
          </div>
        ) : (
          <>
            <button
              onClick={login}
              disabled={!ready}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-black transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
            >
              {ready ? 'Sign In' : 'Loading…'}
            </button>

            {phase === 'denied' && (
              <div
                className="mt-4 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.25)', color: '#ff7088' }}
              >
                {msg}
              </div>
            )}
          </>
        )}

        <div className="mt-8 pt-5 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] leading-relaxed" style={{ color: '#555' }}>
            회원가입은 제공되지 않습니다.<br />
            관리자가 발급한 계정만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
