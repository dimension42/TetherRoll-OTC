'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PoolCard from '@/components/pools/PoolCard';
import type { Pool } from '@/lib/types';

export default function VipDesk() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pools?scope=vip')
      .then(r => r.json())
      .then(data => {
        setPools(data.pools || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 워터마크 헤더 */}
        <div className="relative mb-8">
          <div
            className="absolute right-0 top-0 text-6xl font-black opacity-5 select-none"
            style={{ color: '#00c9a7', letterSpacing: '0.3em' }}
          >
            PRIVATE DESK
          </div>
          <div className="relative" style={{ borderBottom: '1px solid #123B2A', paddingBottom: 4 }} />
        </div>

        {/* Fiat Pools 섹션 */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-1">Fiat Pools</h2>
              <p className="text-sm" style={{ color: '#8FA398' }}>
                KRW and other fiat-crypto pools, available only to approved members
              </p>
            </div>
            <a
              href="/pools/create"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, #00c9a7, #00a88a)',
                color: '#000',
              }}
            >
              + New Pool
            </a>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
            </div>
          ) : pools.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-12 rounded-2xl text-center"
              style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
            >
              <p className="text-4xl mb-3">💼</p>
              <p className="text-white font-semibold mb-2">No fiat pools yet</p>
              <p className="text-sm mb-4" style={{ color: '#8FA398' }}>
                Be the first to create a KRW-crypto pool
              </p>
              <a
                href="/pools/create"
                className="inline-flex px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)', color: '#000' }}
              >
                + New Pool
              </a>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pools.map((pool, i) => (
                <PoolCard key={pool.id} pool={pool} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* Roll Order 섹션 */}
        <section>
          <h2 className="text-2xl font-black text-white mb-6">Roll Order</h2>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0A2E1F 0%, #050806 100%)',
              border: '2px solid transparent',
              backgroundImage: 'linear-gradient(#0A2E1F, #050806), linear-gradient(135deg, #123B2A, #0A2E1F)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
            }}
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Roll Order</h3>
                  <p className="text-sm" style={{ color: '#8FA398' }}>
                    One order, aggregated across every liquidity venue.
                    <br />
                    Arriving in Phase 2.
                  </p>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(0,201,167,0.1)', color: '#00c9a7', border: '1px solid rgba(0,201,167,0.2)' }}
                >
                  COMING SOON
                </div>
              </div>
              <button
                disabled
                className="px-6 py-3 rounded-xl text-sm font-semibold mt-4 cursor-not-allowed"
                style={{ background: '#1f1f1f', color: '#555' }}
              >
                Coming Soon
              </button>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
