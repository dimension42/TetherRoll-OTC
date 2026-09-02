'use client';

import { useAccount } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useSignMessage } from 'wagmi';

/**
 * 현재 연결된 지갑이 세션의 wallets에 없으면 "Link this wallet" 배너 표시.
 * 링크 시 SIWE 서명 → POST /api/wallets/link
 */
export default function WalletMismatchBanner() {
  const { address, chain } = useAccount();
  const { user, refresh } = useAuth();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const { signMessageAsync } = useSignMessage();

  if (!address || !user) return null;

  const isLinked = user.wallets.some(w => w.address.toLowerCase() === address.toLowerCase());
  if (isLinked) return null;

  const handleLink = async () => {
    setLinking(true);
    setError('');

    try {
      // 1. nonce 조회
      const nonceRes = await fetch('/api/auth/siwe/nonce');
      const { nonce } = await nonceRes.json();

      // 2. SIWE 메시지 생성 (직접 구성)
      const message = `${window.location.host} wants you to sign in with your Ethereum account:
${address}

Link this wallet to your TetherRoll account

URI: ${window.location.origin}
Version: 1
Chain ID: ${chain?.id || 1}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;

      // 3. 서명
      const signature = await signMessageAsync({ message });

      // 4. 링크 요청
      const linkRes = await fetch('/api/wallets/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });

      if (!linkRes.ok) {
        const data = await linkRes.json();
        throw new Error(data.error || 'Failed to link wallet');
      }

      // 5. 세션 갱신
      await refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to link wallet');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div
      className="px-4 py-3 flex items-center justify-between"
      style={{ background: 'rgba(245,166,35,0.1)', borderBottom: '1px solid rgba(245,166,35,0.2)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔗</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#f5a623' }}>
            New wallet detected
          </p>
          <p className="text-xs" style={{ color: '#8FA398' }}>
            This wallet is not linked to your account yet
          </p>
        </div>
      </div>
      <button
        onClick={handleLink}
        disabled={linking}
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        style={{
          background: linking ? '#555' : 'linear-gradient(135deg, #00c9a7, #00a88a)',
          color: '#000',
          cursor: linking ? 'not-allowed' : 'pointer',
        }}
      >
        {linking ? 'Linking...' : 'Link Wallet'}
      </button>
      {error && (
        <p className="text-xs ml-3" style={{ color: '#FF4D5E' }}>
          {error}
        </p>
      )}
    </div>
  );
}
