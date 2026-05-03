'use client';

import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MOCK_POOLS, MOCK_ESCROWS } from '@/lib/mockData';
import PoolCard from '@/components/pools/PoolCard';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-5xl mb-4">👤</p>
          <h2 className="text-2xl font-bold text-white mb-2">My Page</h2>
          <p className="mb-6" style={{ color: '#666' }}>Please connect your wallet</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  const myPools = MOCK_POOLS.filter(p => p.creator.toLowerCase() === address?.toLowerCase());
  const myEscrows = MOCK_ESCROWS.filter(e =>
    e.partyA.toLowerCase() === address?.toLowerCase() ||
    e.partyB.toLowerCase() === address?.toLowerCase()
  );

  const completedTrades = myEscrows.filter(e => e.status === 'COMPLETED').length;
  const activeTrades = myEscrows.filter(e => e.status === 'ACTIVE' || e.status === 'PENDING').length;

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#080808' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center gap-6"
          style={{ background: '#111', border: '1px solid #1f1f1f' }}
        >
          <div
            className="w-20 h-20 rounded-2xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #6366f1, #00ff88)' }}
          />
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white mb-1">My Profile</h1>
            <p className="font-mono text-sm mb-3" style={{ color: '#888' }}>{address}</p>
            <div className="flex flex-wrap gap-4">
              {[
                { label: 'Total Pools', value: MOCK_POOLS.length },
                { label: 'Active Trades', value: activeTrades },
                { label: 'Completed', value: completedTrades },
                { label: 'Success Rate', value: completedTrades ? '100%' : '-' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-xs" style={{ color: '#555' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* My Pools */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">My Pools</h2>
          {myPools.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <p className="text-3xl mb-3">🏊</p>
              <p className="text-white font-semibold mb-2">No pools registered yet</p>
              <a href="/pools/create" className="btn-primary inline-flex mt-2">Register Pool</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myPools.map((pool, i) => <PoolCard key={pool.id} pool={pool} index={i} />)}
            </div>
          )}
        </div>

        {/* My Escrows */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">My Escrow History</h2>
          {myEscrows.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <p className="text-3xl mb-3">🔒</p>
              <p className="text-white font-semibold">No escrow history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myEscrows.map(e => (
                <div
                  key={e.id}
                  className="p-4 rounded-xl flex items-center justify-between"
                  style={{ background: '#111', border: '1px solid #1f1f1f' }}
                >
                  <div>
                    <p className="font-semibold text-white text-sm">Escrow #{e.escrowId} — Pool #{e.poolId}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                      {e.assetAAmount} {e.assetASymbol} ↔ {e.isFiat ? `${Number(e.assetBAmount).toLocaleString()} ${e.fiatCurrency}` : `${e.assetBAmount} ${e.assetBSymbol}`}
                    </p>
                  </div>
                  <span className={`badge-${e.status.toLowerCase()} px-2 py-0.5 rounded-full text-xs font-bold`}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
