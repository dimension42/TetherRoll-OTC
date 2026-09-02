'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import PoolCard from '@/components/pools/PoolCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Pool, PoolStatus } from '@/lib/types';
import { SUPPORTED_CHAINS } from '@/lib/chains';

const STATUS_FILTERS: Array<{ label: string; value: PoolStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Filled', value: 'FILLED' },
];

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // 필터
  const [scope] = useState<'public' | 'vip'>('public'); // VIP는 /vip에서
  const [statusFilter, setStatusFilter] = useState<PoolStatus | 'ALL'>('ALL');
  const [chainFilter, setChainFilter] = useState<number | 'ALL'>('ALL');
  const [symbolSearch, setSymbolSearch] = useState('');

  const loadPools = async (cursor?: string) => {
    try {
      const isInitial = !cursor;
      if (isInitial) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({ scope });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (chainFilter !== 'ALL') params.set('chainId', chainFilter.toString());
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/pools?${params}`);
      if (!res.ok) {
        throw new Error(`Failed to load pools: ${res.status}`);
      }

      const data = await res.json();
      const newPools: Pool[] = data.pools || [];

      if (isInitial) {
        setPools(newPools);
      } else {
        setPools(prev => [...prev, ...newPools]);
      }

      setNextCursor(data.nextCursor || null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load pools');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadPools();
  }, [scope, statusFilter, chainFilter]);

  // 클라이언트 심볼 검색
  const filtered = symbolSearch
    ? pools.filter(p =>
        p.offer_symbol.toLowerCase().includes(symbolSearch.toLowerCase()) ||
        p.request_symbol.toLowerCase().includes(symbolSearch.toLowerCase()) ||
        p.fiat_currency?.toLowerCase().includes(symbolSearch.toLowerCase())
      )
    : pools;

  const activePools = pools.filter(p => p.status === 'OPEN' || p.status === 'PARTIAL').length;

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-8">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">Explore Pools</h1>
              <p style={{ color: '#666' }}>Loading...</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="p-5 rounded-2xl animate-pulse"
                style={{ background: '#0F1712', border: '1px solid #1f1f1f', height: '240px' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon="⚠️"
            title="Failed to load pools"
            description={error}
            action={
              <button className="btn-primary" onClick={() => loadPools()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-black text-white mb-2"
            >
              Explore Pools
            </motion.h1>
            <p style={{ color: '#666' }}>
              <span className="font-semibold font-mono" style={{ color: '#00c9a7' }}>{activePools}</span> active pools
            </p>
          </div>
          <Link href="/pools/create" className="btn-primary shrink-0">
            + Create Pool
          </Link>
        </div>

        {/* Filters */}
        <div
          className="p-4 rounded-2xl mb-6"
          style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
        >
          <div className="flex flex-col gap-4">
            {/* 심볼 검색 */}
            <input
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{
                background: '#050806',
                border: '1px solid #2a2a2a',
                color: '#f0f0f0',
              }}
              placeholder="Search by symbol..."
              value={symbolSearch}
              onChange={e => setSymbolSearch(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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

              {/* Chain filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: '#888' }}>Chain:</span>
                <select
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{
                    background: '#050806',
                    border: '1px solid #2a2a2a',
                    color: '#f0f0f0',
                  }}
                  value={chainFilter}
                  onChange={e => setChainFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                >
                  <option value="ALL">All</option>
                  {SUPPORTED_CHAINS.map(chain => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pool grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No pools found"
            description={
              pools.length === 0
                ? 'No pools yet. Create the first one!'
                : 'Try different search criteria'
            }
            action={
              pools.length === 0 ? (
                <Link href="/pools/create" className="btn-primary inline-flex">
                  + Create Pool
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {filtered.map((pool, i) => (
                <PoolCard key={pool.id} pool={pool} index={i} />
              ))}
            </div>

            {/* Load more */}
            {nextCursor && !symbolSearch && (
              <div className="text-center">
                <button
                  onClick={() => loadPools(nextCursor)}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: loadingMore ? 'rgba(255,255,255,0.03)' : 'rgba(0,201,167,0.1)',
                    color: loadingMore ? '#555' : '#00c9a7',
                    border: `1px solid ${loadingMore ? 'rgba(255,255,255,0.05)' : 'rgba(0,201,167,0.2)'}`,
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
