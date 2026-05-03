'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import PoolCard from '@/components/pools/PoolCard';
import { MOCK_POOLS } from '@/lib/mockData';
import type { Pool, PoolStatus, TradeType } from '@/lib/types';

const STATUS_FILTERS: { label: string; value: PoolStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Matched', value: 'MATCHED' },
  { label: 'Completed', value: 'COMPLETED' },
];

const TYPE_FILTERS: { label: string; value: TradeType | 'ALL' }[] = [
  { label: 'All Types', value: 'ALL' },
  { label: '⟠ Crypto ↔ Crypto', value: 'CRYPTO_CRYPTO' },
  { label: '💵 Crypto → Fiat', value: 'CRYPTO_FIAT' },
  { label: '💵 Fiat → Crypto', value: 'FIAT_CRYPTO' },
];

export default function PoolsPage() {
  const [statusFilter, setStatusFilter] = useState<PoolStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<TradeType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'amount' | 'fill'>('newest');

  const filtered = useMemo(() => {
    let pools = [...MOCK_POOLS];

    if (statusFilter !== 'ALL') pools = pools.filter(p => p.status === statusFilter);
    if (typeFilter !== 'ALL') pools = pools.filter(p => p.tradeType === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      pools = pools.filter(p =>
        p.offerSymbol.toLowerCase().includes(q) ||
        p.requestSymbol.toLowerCase().includes(q) ||
        p.creator.toLowerCase().includes(q) ||
        p.fiatCurrency?.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'newest') pools.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'amount') pools.sort((a, b) => Number(b.offerAmount) - Number(a.offerAmount));
    else if (sortBy === 'fill') pools.sort((a, b) => b.filledPercent - a.filledPercent);

    return pools;
  }, [statusFilter, typeFilter, search, sortBy]);

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#080808' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-black text-white mb-2"
            >
              Explore OTC Pools
            </motion.h1>
            <p style={{ color: '#666' }}>
              <span className="font-semibold" style={{ color: '#00c9a7' }}>{MOCK_POOLS.filter(p => p.status === 'OPEN' || p.status === 'PARTIAL').length}</span> active pools
            </p>
          </div>
          <Link href="/pools/create" className="btn-primary shrink-0">
            + New Pool
          </Link>
        </div>

        {/* Filters */}
        <div
          className="p-4 rounded-2xl mb-6"
          style={{ background: '#111', border: '1px solid #1f1f1f' }}
        >
          <div className="flex flex-col gap-4">
            {/* Search */}
            <input
              className="input-dark"
              placeholder="Search by token or wallet address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div className="flex flex-wrap gap-3 items-center justify-between">
              {/* Status filter */}
              <div className="flex gap-2 flex-wrap">
                {STATUS_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                      background: statusFilter === f.value ? 'rgba(0,201,167,0.15)' : 'rgba(255,255,255,0.04)',
                      color: statusFilter === f.value ? '#00c9a7' : '#888',
                      border: `1px solid ${statusFilter === f.value ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select
                className="input-dark w-auto px-3 py-1.5 text-sm"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="newest">Newest</option>
                <option value="amount">Amount</option>
                <option value="fill">Fill Rate</option>
              </select>
            </div>

            {/* Type filter */}
            <div className="flex gap-2 flex-wrap">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                  style={{
                    background: typeFilter === f.value ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                    color: typeFilter === f.value ? '#a78bfa' : '#666',
                    border: `1px solid ${typeFilter === f.value ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pool grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-xl font-semibold text-white mb-2">No pools found</p>
            <p style={{ color: '#666' }}>Try different search criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((pool, i) => (
              <PoolCard key={pool.id} pool={pool} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
