'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import type { Pool } from '@/lib/types';

export default function PoolDetailPage() {
  const { id } = useParams();
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPool() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/pools/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Pool not found');
          } else {
            throw new Error(`Failed to load pool: ${res.status}`);
          }
          return;
        }
        const data = await res.json();
        setPool(data.pool);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Failed to load pool');
      } finally {
        setLoading(false);
      }
    }
    loadPool();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-2xl font-bold text-white mb-2">{error || 'Pool not found'}</p>
          <Link href="/pools" className="btn-secondary mt-4">Back to Pools</Link>
        </div>
      </div>
    );
  }

  const isFiat = pool.trade_type !== 'CRYPTO_CRYPTO';
  const statusMap: Record<string, { label: string; cls: string }> = {
    OPEN: { label: 'OPEN', cls: 'badge-open' },
    PARTIAL: { label: 'PARTIAL', cls: 'badge-partial' },
    MATCHED: { label: 'MATCHED', cls: 'badge-matched' },
    CANCELLED: { label: 'CANCELLED', cls: 'badge-cancelled' },
    COMPLETED: { label: 'COMPLETED', cls: 'badge-completed' },
  };
  const statusInfo = statusMap[pool.status] || statusMap.OPEN;

  // fiat 풀 금액 표기
  const offerAmount = isFiat && pool.trade_type === 'FIAT_CRYPTO' && pool.fiat_currency
    ? pool.offer_amount.toLocaleString()
    : pool.offer_amount.toString();
  const offerSymbol = isFiat && pool.trade_type === 'FIAT_CRYPTO' && pool.fiat_currency
    ? pool.fiat_currency
    : pool.offer_symbol;

  const requestAmount = isFiat && pool.trade_type === 'CRYPTO_FIAT' && pool.fiat_currency
    ? pool.request_amount.toLocaleString()
    : pool.request_amount.toString();
  const requestSymbol = isFiat && pool.trade_type === 'CRYPTO_FIAT' && pool.fiat_currency
    ? pool.fiat_currency
    : pool.request_symbol;

  // 환산 비율 계산
  const rate = (pool.request_amount / pool.offer_amount).toFixed(6);

  return (
    <div className="min-h-screen pt-20 pb-16 grid-bg" style={{ background: '#080808' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-8" style={{ color: '#666' }}>
          <Link href="/pools" className="hover:text-white transition-colors">Pools</Link>
          <span>/</span>
          <span style={{ color: '#00c9a7' }}>Pool {pool.id.slice(0, 8)}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Main card */}
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            {/* Top gradient bar */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #00c9a7, #6366f1, #00ff88)' }} />

            <div className="p-8">
              {/* Status & type */}
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusInfo.cls}`}>
                  ● {statusInfo.label}
                </span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: isFiat ? 'rgba(59,130,246,0.1)' : 'rgba(0,201,167,0.1)',
                    color: isFiat ? '#60a5fa' : '#00c9a7',
                    border: isFiat ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(0,201,167,0.2)',
                  }}
                >
                  {isFiat ? '💵 Cash ↔ Crypto' : '⟠ Crypto ↔ Crypto'}
                </span>
                {pool.collateral_mode === 'KRW_SIDE_LOCKS' && pool.collateral_pct && (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: 'rgba(0,255,136,0.1)',
                      color: '#00ff88',
                      border: '1px solid rgba(0,255,136,0.2)',
                    }}
                  >
                    🔒 Collateral {pool.collateral_pct}%
                  </span>
                )}
              </div>

              {/* Trade pair */}
              <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                <div className="flex-1 p-6 rounded-xl text-center" style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00c9a7' }}>Offer</p>
                  <p className="text-4xl font-black text-white font-mono">{offerAmount}</p>
                  <p className="text-xl font-bold mt-1" style={{ color: '#00c9a7' }}>{offerSymbol}</p>
                  {pool.offer_chain && (
                    <p className="text-xs mt-2" style={{ color: '#555' }}>{pool.offer_chain}</p>
                  )}
                </div>

                <div className="text-4xl">⇄</div>

                <div className="flex-1 p-6 rounded-xl text-center" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00ff88' }}>Request</p>
                  <p className="text-4xl font-black text-white font-mono">{requestAmount}</p>
                  <p className="text-xl font-bold mt-1" style={{ color: '#00ff88' }}>{requestSymbol}</p>
                  {pool.request_chain && (
                    <p className="text-xs mt-2" style={{ color: '#555' }}>{pool.request_chain}</p>
                  )}
                </div>
              </div>

              {/* Rate */}
              <div className="mb-6 p-4 rounded-lg text-center" style={{ background: '#0d0d0d' }}>
                <p className="text-xs mb-1" style={{ color: '#555' }}>Exchange Rate</p>
                <p className="text-lg font-bold text-white font-mono">
                  1 {offerSymbol} = {rate} {requestSymbol}
                </p>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Fill Rate', value: `${pool.filled_pct.toFixed(0)}%` },
                  { label: 'Created', value: formatDistanceToNow(new Date(pool.created_at), { addSuffix: true }) },
                  { label: 'Expires', value: pool.expires_at ? format(new Date(pool.expires_at), 'MM/dd HH:mm') : 'Never' },
                  { label: 'Chain ID', value: pool.chain_id?.toString() || 'N/A' },
                ].map(d => (
                  <div key={d.label} className="p-4 rounded-lg" style={{ background: '#0d0d0d' }}>
                    <p className="text-xs mb-1" style={{ color: '#555' }}>{d.label}</p>
                    <p className="text-sm font-semibold text-white">{d.value}</p>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <button
                disabled
                className="w-full text-base py-4 rounded-xl font-bold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  color: '#555',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'not-allowed',
                }}
              >
                Take This Pool
              </button>
              <p className="text-xs text-center mt-2" style={{ color: '#555' }}>
                On-chain settlement arrives with EscrowVault v2 (Phase 3)
              </p>
            </div>
          </div>

          {/* Security note */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)' }}>
            <p className="text-sm" style={{ color: '#666' }}>
              🔒 <span style={{ color: '#00ff88' }}>On-Chain Escrow Protection</span> — Both parties' assets are locked in a smart contract upon participation. No one can access the assets until the trade is completed.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
