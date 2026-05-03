'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { Pool } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

function shortenAddr(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function FilledBar({ pct }: { pct: number }) {
  const filled = pct / 100;
  return (
    <div className="w-full h-1.5 rounded-full mt-2" style={{ background: '#1a1a1a' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${filled}%`,
          background: filled >= 100 ? '#00ff88' : filled > 50 ? '#f0b429' : '#6366f1',
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
                  background: pool.isFiat ? 'rgba(59,130,246,0.1)' : 'rgba(240,180,41,0.1)',
                  color: pool.isFiat ? '#60a5fa' : '#f0b429',
                  border: pool.isFiat ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(240,180,41,0.2)',
                }}
              >
                {pool.isFiat ? '💵 FIAT' : '⟠ CRYPTO'}
              </span>
              <span className="text-xs" style={{ color: '#555' }}>#{pool.poolId}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* Trade pair */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{pool.offerAmount}</p>
              <p className="text-sm font-semibold" style={{ color: '#f0b429' }}>{pool.offerSymbol}</p>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>제공</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="flex items-center gap-1">
                <div className="h-px flex-1 w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <span className="text-lg">⇄</span>
                <div className="h-px flex-1 w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">
                {pool.isFiat
                  ? Number(pool.fiatAmount).toLocaleString()
                  : pool.requestAmount}
              </p>
              <p className="text-sm font-semibold" style={{ color: '#00ff88' }}>
                {pool.isFiat ? `${pool.fiatCurrency}` : pool.requestSymbol}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>요청</p>
            </div>
          </div>

          {/* Fill progress */}
          {pool.status === 'PARTIAL' && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#888' }}>충족률</span>
                <span style={{ color: '#f0b429' }}>{(pool.filledPercent / 100).toFixed(0)}%</span>
              </div>
              <FilledBar pct={pool.filledPercent / 100} />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full" style={{ background: 'linear-gradient(135deg, #f0b429, #6366f1)' }} />
              <span className="text-xs font-mono" style={{ color: '#666' }}>{shortenAddr(pool.creator)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: '#555' }}>
              <span>보증금 {pool.depositAmount} {pool.offerSymbol}</span>
              <span>·</span>
              <span>{formatDistanceToNow(pool.createdAt, { addSuffix: true, locale: ko })}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
