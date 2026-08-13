'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import SignInPrompt from '@/components/auth/SignInPrompt';

export default function EscrowPage() {
  const { authenticated, ready } = useAuth();

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
        </div>

        {/* 스탯 카드 — 모두 0 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active', count: 0, color: '#00ff88' },
            { label: 'Pending', count: 0, color: '#00c9a7' },
            { label: 'Disputed', count: 0, color: '#fb923c' },
            { label: 'Completed', count: 0, color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
              <p className="text-sm" style={{ color: '#666' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* 빈 상태 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 rounded-2xl"
          style={{ background: '#111', border: '1px solid #1f1f1f' }}
        >
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-xl font-bold text-white mb-2">No escrows yet</p>
          <p className="text-sm" style={{ color: '#666' }}>
            On-chain escrow (EscrowVault v2) arrives in Phase 3.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
