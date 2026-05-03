'use client';

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { MOCK_POOLS } from '@/lib/mockData';
import { formatDistanceToNow, format } from 'date-fns';
import SignInPrompt from '@/components/auth/SignInPrompt';

function shortenAddr(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function PoolDetailPage() {
  const { id } = useParams();
  const { user, authenticated } = useAuth();
  const address = user?.wallet?.address;
  const isConnected = authenticated;
  const pool = MOCK_POOLS.find(p => p.id === id);

  if (!pool) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-2xl font-bold text-white mb-2">Pool not found</p>
          <Link href="/pools" className="btn-secondary mt-4">Back to Pools</Link>
        </div>
      </div>
    );
  }

  const isOwner = address?.toLowerCase() === pool.creator.toLowerCase();
  const canMatch = !isOwner && (pool.status === 'OPEN' || pool.status === 'PARTIAL');

  return (
    <div className="min-h-screen pt-20 pb-16 grid-bg" style={{ background: '#080808' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-8" style={{ color: '#666' }}>
          <Link href="/pools" className="hover:text-white transition-colors">Pools</Link>
          <span>/</span>
          <span style={{ color: '#00c9a7' }}>Pool #{pool.poolId}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Main card */}
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            {/* Top gradient bar */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #00c9a7, #6366f1, #00ff88)' }} />

            <div className="p-8">
              {/* Status & type */}
              <div className="flex items-center gap-3 mb-6">
                <span className={`px-3 py-1 rounded-full text-sm font-bold badge-${pool.status.toLowerCase()}`}>
                  ● {pool.status}
                </span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: pool.isFiat ? 'rgba(59,130,246,0.1)' : 'rgba(0,201,167,0.1)',
                    color: pool.isFiat ? '#60a5fa' : '#00c9a7',
                    border: pool.isFiat ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(0,201,167,0.2)',
                  }}
                >
                  {pool.isFiat ? '💵 Cash ↔ Crypto' : '⟠ Crypto ↔ Crypto'}
                </span>
              </div>

              {/* Trade pair */}
              <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                <div className="flex-1 p-6 rounded-xl text-center" style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00c9a7' }}>Offer</p>
                  <p className="text-4xl font-black text-white">{pool.offerAmount}</p>
                  <p className="text-xl font-bold mt-1" style={{ color: '#00c9a7' }}>{pool.offerSymbol}</p>
                </div>

                <div className="text-4xl">⇄</div>

                <div className="flex-1 p-6 rounded-xl text-center" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00ff88' }}>Request</p>
                  <p className="text-4xl font-black text-white">
                    {pool.isFiat ? Number(pool.fiatAmount).toLocaleString() : pool.requestAmount}
                  </p>
                  <p className="text-xl font-bold mt-1" style={{ color: '#00ff88' }}>
                    {pool.isFiat ? pool.fiatCurrency : pool.requestSymbol}
                  </p>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Deposit', value: `${pool.depositAmount} ${pool.offerSymbol}` },
                  { label: 'Fill Rate', value: `${(pool.filledPercent / 100).toFixed(0)}%` },
                  { label: 'Created', value: formatDistanceToNow(pool.createdAt, { addSuffix: true }) },
                  { label: 'Expires', value: format(pool.expiresAt, 'MM/dd HH:mm') },
                ].map(d => (
                  <div key={d.label} className="p-4 rounded-lg" style={{ background: '#0d0d0d' }}>
                    <p className="text-xs mb-1" style={{ color: '#555' }}>{d.label}</p>
                    <p className="text-sm font-semibold text-white">{d.value}</p>
                  </div>
                ))}
              </div>

              {/* Creator */}
              <div className="flex items-center gap-3 p-4 rounded-lg mb-6" style={{ background: '#0d0d0d' }}>
                <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #00c9a7, #6366f1)' }} />
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#555' }}>Creator</p>
                  <p className="text-sm font-mono text-white">{pool.creator}</p>
                </div>
                {isOwner && (
                  <span className="ml-auto px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(0,201,167,0.1)', color: '#00c9a7' }}>My Pool</span>
                )}
              </div>

              {/* Action buttons */}
              {!isConnected ? (
                <div className="flex justify-center">
                  <SignInPrompt label="Sign In to Trade" />
                </div>
              ) : isOwner ? (
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1">Extend Expiry</button>
                  <button className="btn-danger flex-1">Cancel Pool</button>
                </div>
              ) : canMatch ? (
                <button
                  className="btn-primary w-full text-base py-4 justify-center"
                  onClick={() => alert('Create Escrow - Will be enabled after contract integration')}
                >
                  Participate in this Pool (Create Escrow)
                </button>
              ) : (
                <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', color: '#666' }}>
                  {pool.status === 'COMPLETED' ? 'This pool has been completed' : 'This pool is not available for participation'}
                </div>
              )}
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
