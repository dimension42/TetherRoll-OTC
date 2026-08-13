'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import PoolCard from '@/components/pools/PoolCard';
import type { Pool, PoolStatus } from '@/lib/types';

const STATUS_FILTERS: { label: string; value: PoolStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Matched', value: 'MATCHED' },
  { label: 'Completed', value: 'COMPLETED' },
];

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PoolStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'amount' | 'fill'>('newest');

  useEffect(() => {
    async function loadPools() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/pools');
        if (!res.ok) {
          throw new Error(`Failed to load pools: ${res.status}`);
        }
        const data = await res.json();
        setPools(data.pools || []);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Failed to load pools');
      } finally {
        setLoading(false);
      }
    }
    loadPools();
  }, []);

  const filtered = useMemo(() => {
    let result = [...pools];

    if (statusFilter !== 'ALL') result = result.filter(p => p.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.offer_symbol.toLowerCase().includes(q) ||
        p.request_symbol.toLowerCase().includes(q) ||
        p.fiat_currency?.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'amount') result.sort((a, b) => b.offer_amount - a.offer_amount);
    else if (sortBy === 'fill') result.sort((a, b) => b.filled_pct - a.filled_pct);

    return result;
  }, [pools, statusFilter, search, sortBy]);

  const activePools = pools.filter(p => p.status === 'OPEN' || p.status === 'PARTIAL').length;

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-16" style={{ background: '#080808' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-8">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">Explore OTC Pools</h1>
              <p style={{ color: '#666' }}>Loading...</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="p-5 rounded-2xl animate-pulse"
                style={{ background: '#111111', border: '1px solid #1f1f1f', height: '220px' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-20 pb-16" style={{ background: '#080808' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="text-xl font-semibold text-white mb-2">Failed to load pools</p>
            <p className="mb-6" style={{ color: '#666' }}>{error}</p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <span className="font-semibold" style={{ color: '#00c9a7' }}>{activePools}</span> active pools
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
              placeholder="Search by symbol..."
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
          </div>
        </div>

        {/* Pool grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-xl font-semibold text-white mb-2">No pools found</p>
            <p className="mb-4" style={{ color: '#666' }}>
              {pools.length === 0 ? 'No open pools yet — create the first one' : 'Try different search criteria'}
            </p>
            {pools.length === 0 && (
              <Link href="/pools/create" className="btn-primary inline-flex">
                + Create Pool
              </Link>
            )}
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
