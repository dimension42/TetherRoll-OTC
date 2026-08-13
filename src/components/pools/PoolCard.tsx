'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { Pool } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

function FilledBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-1.5 rounded-full mt-2" style={{ background: '#1a1a1a' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: pct >= 100 ? '#00ff88' : pct > 50 ? '#00c9a7' : '#6366f1',
        }}
      />
    </div>
  );
}

export default function PoolCard({ pool, index }: { pool: Pool; index: number }) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    OPEN: { label: 'OPEN', cls: 'badge-open' },
    PARTIAL: { label: 'PARTIAL', cls: 'badge-partial' },
    MATCHED: { label: 'MATCHED', cls: 'badge-matched' },
    CANCELLED: { label: 'CANCELLED', cls: 'badge-cancelled' },
    COMPLETED: { label: 'COMPLETED', cls: 'badge-completed' },
  };
  const statusInfo = statusMap[pool.status] || statusMap.OPEN;

  const isFiat = pool.trade_type !== 'CRYPTO_CRYPTO';

  // fiat 풀인 경우 금액 결정
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/pools/${pool.id}`}>
        <div
          className="p-5 rounded-2xl card-hover"
          style={{ background: '#111111', border: '1px solid #1f1f1f' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: isFiat ? 'rgba(59,130,246,0.1)' : 'rgba(0,201,167,0.1)',
                  color: isFiat ? '#60a5fa' : '#00c9a7',
                  border: isFiat ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(0,201,167,0.2)',
                }}
              >
                {isFiat ? '💵 FIAT' : '⟠ CRYPTO'}
              </span>
              {pool.collateral_mode === 'KRW_SIDE_LOCKS' && pool.collateral_pct && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
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
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* Trade pair */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-black text-white font-mono">{offerAmount}</p>
              <p className="text-sm font-semibold" style={{ color: '#00c9a7' }}>{offerSymbol}</p>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>Offer</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="flex items-center gap-1">
                <div className="h-px flex-1 w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <span className="text-lg">⇄</span>
                <div className="h-px flex-1 w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white font-mono">{requestAmount}</p>
              <p className="text-sm font-semibold" style={{ color: '#00ff88' }}>{requestSymbol}</p>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>Request</p>
            </div>
          </div>

          {/* Fill progress */}
          {pool.status === 'PARTIAL' && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#888' }}>Fill Rate</span>
                <span style={{ color: '#00c9a7' }}>{pool.filled_pct.toFixed(0)}%</span>
              </div>
              <FilledBar pct={pool.filled_pct} />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
            <div className="flex items-center gap-3 text-xs" style={{ color: '#555' }}>
              <span>{formatDistanceToNow(new Date(pool.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
