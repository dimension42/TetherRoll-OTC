'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';

type Tab = 'pools' | 'taker' | 'fiat' | 'desk' | 'history';

export default function TradesPage() {
  const { authenticated, ready, login } = useAuth();
  const [tab, setTab] = useState<Tab>('pools');

  if (!ready) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#050806' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center grid-bg" style={{ background: '#050806' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-5xl mb-4">🔗</p>
          <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="mb-6" style={{ color: '#666' }}>Please sign in to view your trades</p>
          <button className="btn-primary" onClick={login}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">My Trades</h1>
          <p style={{ color: '#666' }}>View and manage your pools and trades</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: 'pools' as const, label: 'My Pools' },
            { key: 'taker' as const, label: 'As Taker' },
            { key: 'fiat' as const, label: 'Fiat Trades' },
            { key: 'desk' as const, label: '🏦 Desk' },
            { key: 'history' as const, label: 'History' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: tab === t.key ? (t.key === 'desk' ? 'rgba(245,166,35,0.15)' : 'rgba(0,201,167,0.15)') : 'rgba(255,255,255,0.04)',
                color: tab === t.key ? (t.key === 'desk' ? '#f5a623' : '#00c9a7') : '#888',
                border: `1px solid ${tab === t.key ? (t.key === 'desk' ? 'rgba(245,166,35,0.3)' : 'rgba(0,201,167,0.3)') : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          className="rounded-2xl p-8"
          style={{ background: '#111', border: '1px solid #1f1f1f', minHeight: '400px' }}
        >
          <EmptyState
            icon="🔨"
            title="Under Construction"
            description={`${
              tab === 'pools' ? 'Your created pools' :
              tab === 'taker' ? 'Pools you have taken' :
              tab === 'fiat' ? 'Your fiat trades' :
              tab === 'desk' ? 'Your custody desk trades (BTC, Solana, Tron, KRW)' :
              'Completed trades'
            } will appear here.`}
            action={
              tab === 'pools' ? (
                <Link href="/pools/create" className="btn-primary">
                  + Create Pool
                </Link>
              ) : (
                <Link href="/pools" className="btn-secondary">
                  Browse Pools
                </Link>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
