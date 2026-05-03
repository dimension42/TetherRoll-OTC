'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { MOCK_ESCROWS } from '@/lib/mockData';
import type { Escrow, EscrowStatus } from '@/lib/types';
import Link from 'next/link';
import SignInPrompt from '@/components/auth/SignInPrompt';

function shortenAddr(addr: string) { return addr.slice(0, 6) + '...' + addr.slice(-4); }

function CountdownTimer({ deadline }: { deadline: number }) {
  const diff = deadline - Date.now();
  if (diff <= 0) return <span style={{ color: '#ff4466' }}>Expired</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const color = h < 24 ? '#ff4466' : h < 48 ? '#00c9a7' : '#00ff88';
  return (
    <span style={{ color }} className="font-mono font-bold">
      {h}h {m}m
    </span>
  );
}

function EscrowCard({ escrow }: { escrow: Escrow }) {
  const statusColors: Record<EscrowStatus, string> = {
    PENDING: '#00c9a7', ACTIVE: '#00ff88', COMPLETED: '#a78bfa',
    DISPUTED: '#fb923c', CANCELLED: '#ff4466',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: '#111', border: '1px solid #1f1f1f' }}
    >
      {/* Status bar */}
      <div
        className="h-1"
        style={{ background: statusColors[escrow.status] }}
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: statusColors[escrow.status] + '22',
                color: statusColors[escrow.status],
                border: `1px solid ${statusColors[escrow.status]}44`,
              }}
            >
              ● {escrow.status}
            </span>
            <span className="text-xs font-mono" style={{ color: '#555' }}>Escrow #{escrow.escrowId}</span>
          </div>
          <div className="text-xs" style={{ color: '#555' }}>
            Pool #{escrow.poolId}
          </div>
        </div>

        {/* Assets */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 p-3 rounded-lg text-center" style={{ background: '#0d0d0d' }}>
            <p className="text-xs mb-1" style={{ color: '#555' }}>PartyA (Crypto)</p>
            <p className="text-lg font-bold text-white">{escrow.assetAAmount}</p>
            <p className="text-sm" style={{ color: '#00c9a7' }}>{escrow.assetASymbol}</p>
          </div>
          <span className="text-xl">⇄</span>
          <div className="flex-1 p-3 rounded-lg text-center" style={{ background: '#0d0d0d' }}>
            <p className="text-xs mb-1" style={{ color: '#555' }}>
              PartyB ({escrow.isFiat ? 'Fiat' : 'Crypto'})
            </p>
            <p className="text-lg font-bold text-white">
              {escrow.isFiat ? Number(escrow.assetBAmount).toLocaleString() : escrow.assetBAmount}
            </p>
            <p className="text-sm" style={{ color: '#00ff88' }}>
              {escrow.isFiat ? escrow.fiatCurrency : escrow.assetBSymbol}
            </p>
          </div>
        </div>

        {/* Info row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg" style={{ background: '#0d0d0d' }}>
            <p className="text-xs mb-1" style={{ color: '#555' }}>Time Left</p>
            <CountdownTimer deadline={escrow.deadline} />
          </div>
          <div className="p-3 rounded-lg" style={{ background: '#0d0d0d' }}>
            <p className="text-xs mb-1" style={{ color: '#555' }}>Fee</p>
            <p className="text-sm font-semibold text-white">{escrow.feeAmount} {escrow.assetASymbol}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: '#0d0d0d' }}>
            <p className="text-xs mb-1" style={{ color: '#555' }}>Penalty</p>
            <p className="text-sm font-semibold text-white">{escrow.penaltyAmount} {escrow.assetASymbol}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="flex gap-3 mb-4 text-xs">
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg" style={{ background: '#0d0d0d' }}>
            <div className="w-5 h-5 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }} />
            <div>
              <p style={{ color: '#555' }}>PartyA</p>
              <p className="font-mono text-white">{shortenAddr(escrow.partyA)}</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg" style={{ background: '#0d0d0d' }}>
            <div className="w-5 h-5 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #00ff88, #00d4ff)' }} />
            <div>
              <p style={{ color: '#555' }}>PartyB</p>
              <p className="font-mono text-white">{shortenAddr(escrow.partyB)}</p>
            </div>
          </div>
        </div>

        {/* Action buttons based on status */}
        {escrow.status === 'ACTIVE' && (
          <div className="flex gap-3">
            <button
              className="btn-primary flex-1 justify-center text-sm py-2.5"
              onClick={() => alert('confirmDelivery() - Will be enabled after contract integration')}
            >
              ✅ Confirm Delivery
            </button>
            <button
              className="btn-danger flex-1 justify-center text-sm py-2.5"
              onClick={() => alert('raiseDispute() - Will be enabled after contract integration')}
            >
              ⚠️ Raise Dispute
            </button>
          </div>
        )}
        {escrow.status === 'PENDING' && (
          <button
            className="btn-primary w-full justify-center text-sm py-2.5"
            onClick={() => alert('lockCounterparty() - Will be enabled after contract integration')}
          >
            🔒 Deposit & Activate Escrow
          </button>
        )}
        {escrow.status === 'DISPUTED' && (
          <div className="p-3 rounded-lg text-center text-sm" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', color: '#fb923c' }}>
            ⚖️ Arbitration in progress — Ruling expected within 48 hours
          </div>
        )}
        {escrow.status === 'COMPLETED' && (
          <div className="p-3 rounded-lg text-center text-sm" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>
            ✅ Trade Completed
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function EscrowPage() {
  const { authenticated, ready } = useAuth();
  const [filter, setFilter] = useState<EscrowStatus | 'ALL'>('ALL');

  const filtered = filter === 'ALL' ? MOCK_ESCROWS : MOCK_ESCROWS.filter(e => e.status === filter);

  if (!ready) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="mb-6" style={{ color: '#666' }}>Please sign in to manage escrows</p>
          <SignInPrompt />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#080808' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">Escrow Management</h1>
            <p style={{ color: '#666' }}>Manage your active OTC trades</p>
          </div>
          <Link href="/pools" className="btn-secondary shrink-0">Explore Pools</Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active', count: MOCK_ESCROWS.filter(e => e.status === 'ACTIVE').length, color: '#00ff88' },
            { label: 'Pending', count: MOCK_ESCROWS.filter(e => e.status === 'PENDING').length, color: '#00c9a7' },
            { label: 'Disputed', count: MOCK_ESCROWS.filter(e => e.status === 'DISPUTED').length, color: '#fb923c' },
            { label: 'Completed', count: MOCK_ESCROWS.filter(e => e.status === 'COMPLETED').length, color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
              <p className="text-sm" style={{ color: '#666' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['ALL', 'ACTIVE', 'PENDING', 'DISPUTED', 'COMPLETED', 'CANCELLED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: filter === f ? 'rgba(0,201,167,0.15)' : 'rgba(255,255,255,0.04)',
                color: filter === f ? '#00c9a7' : '#666',
                border: `1px solid ${filter === f ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Escrow list */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(e => <EscrowCard key={e.id} escrow={e} />)}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-xl font-bold text-white">No escrows found</p>
          </div>
        )}
      </div>
    </div>
  );
}
