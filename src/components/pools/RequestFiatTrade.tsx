'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AmountInput } from '@/components/ui/AmountInput';
import type { Pool, BankInfo } from '@/lib/types';

export function RequestFiatTrade({ pool }: { pool: Pool }) {
  const router = useRouter();
  const { user, authenticated } = useAuth();

  const [fiatAmount, setFiatAmount] = useState('');
  const [bankInfo, setBankInfo] = useState<BankInfo>({ bank: '', account: '', holder: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 역할 설명
  const isFiatCrypto = pool.trade_type === 'FIAT_CRYPTO'; // maker는 crypto 구매자, 요청자는 crypto 판매자
  const callerIsSeller = isFiatCrypto;

  // 수량 범위
  const maxFiat = pool.fiat_currency === 'KRW' ? parseFloat(pool.trade_type === 'FIAT_CRYPTO' ? pool.offer_amount : pool.request_amount) : 0;

  const handleRequest = async () => {
    setError(null);

    // 검증
    if (!authenticated || !user) {
      setError('Please log in to request a trade');
      return;
    }

    if (!user.wallets || user.wallets.length === 0) {
      setError('Please link a wallet to your account');
      return;
    }

    const amountNum = parseFloat(fiatAmount);
    if (!fiatAmount || amountNum <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (!pool.allow_partial && amountNum !== maxFiat) {
      setError(`This pool requires full amount: ₩${maxFiat.toLocaleString('ko-KR')}`);
      return;
    }

    if (amountNum > maxFiat) {
      setError(`Amount exceeds pool maximum: ₩${maxFiat.toLocaleString('ko-KR')}`);
      return;
    }

    // 판매자면 계좌 정보 필수
    if (callerIsSeller) {
      if (!bankInfo.bank || !bankInfo.account || !bankInfo.holder) {
        setError('Bank information is required for crypto sellers');
        return;
      }
    }

    try {
      setLoading(true);

      const body: { poolId: string; fiatAmount?: string; bankInfo?: BankInfo } = {
        poolId: pool.id,
      };

      if (pool.fiat_currency === 'KRW') {
        body.fiatAmount = Math.round(amountNum).toString();
      }

      if (callerIsSeller) {
        body.bankInfo = bankInfo;
      }

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      const data = await res.json();
      router.push(`/trades/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
      <h3 className="text-xl font-bold text-white mb-4">Request FIAT Trade</h3>

      {/* 역할 설명 */}
      <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <p className="text-sm" style={{ color: '#60a5fa' }}>
          {isFiatCrypto ? (
            <>
              You are the <strong>crypto seller</strong>. You will lock crypto, and the pool maker will transfer KRW to you.
            </>
          ) : (
            <>
              You are the <strong>crypto buyer</strong>. The pool maker will lock crypto, and you will transfer KRW to them.
            </>
          )}
        </p>
      </div>

      {/* 수량 입력 */}
      {pool.allow_partial && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: '#888' }}>
              Amount (KRW)
            </span>
            <span className="text-xs font-semibold" style={{ color: '#00c9a7' }}>
              Max: ₩{maxFiat.toLocaleString('ko-KR')}
            </span>
          </div>
          <AmountInput
            value={fiatAmount}
            onChange={setFiatAmount}
            placeholder="0"
          />
        </div>
      )}

      {!pool.allow_partial && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: '#050806', border: '1px solid #2a2a2a' }}>
          <p className="text-sm" style={{ color: '#888' }}>
            Full amount only: <span className="font-mono font-semibold text-white">₩{maxFiat.toLocaleString('ko-KR')}</span>
          </p>
        </div>
      )}

      {/* 계좌 정보 (판매자만) */}
      {callerIsSeller && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2" style={{ color: '#888' }}>
            Bank Information (for receiving KRW)
          </p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Bank name"
              value={bankInfo.bank}
              onChange={e => setBankInfo(prev => ({ ...prev, bank: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{
                background: '#050806',
                border: '1px solid #2a2a2a',
                color: '#f0f0f0',
              }}
            />
            <input
              type="text"
              placeholder="Account number"
              value={bankInfo.account}
              onChange={e => setBankInfo(prev => ({ ...prev, account: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{
                background: '#050806',
                border: '1px solid #2a2a2a',
                color: '#f0f0f0',
              }}
            />
            <input
              type="text"
              placeholder="Account holder name"
              value={bankInfo.holder}
              onChange={e => setBankInfo(prev => ({ ...prev, holder: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{
                background: '#050806',
                border: '1px solid #2a2a2a',
                color: '#f0f0f0',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm mb-4" style={{ color: '#FF4D5E' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleRequest}
        disabled={loading || !authenticated}
        className="w-full px-4 py-3 rounded-xl text-base font-bold transition-all"
        style={{
          background: loading || !authenticated ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #00c9a7, #00a88a)',
          color: loading || !authenticated ? '#555' : '#000',
          border: `1px solid ${loading || !authenticated ? 'rgba(255,255,255,0.05)' : 'rgba(0,201,167,0.3)'}`,
          cursor: loading || !authenticated ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Requesting...' : !authenticated ? 'Log in to request' : 'Request Trade'}
      </button>

      {pool.collateral_mode === 'KRW_SIDE_LOCKS' && pool.collateral_pct && (
        <p className="text-xs mt-3 text-center" style={{ color: '#666' }}>
          {callerIsSeller ? (
            <>
              You will need to lock a {pool.collateral_pct}% bond in the next step.
            </>
          ) : (
            <>
              The seller will lock a {pool.collateral_pct}% bond after you confirm.
            </>
          )}
        </p>
      )}

      {!authenticated && (
        <p className="text-xs mt-3 text-center" style={{ color: '#888' }}>
          Please log in and link a wallet to request FIAT trades.
        </p>
      )}
    </div>
  );
}
