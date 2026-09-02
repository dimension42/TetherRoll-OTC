'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import SignInPrompt from '@/components/auth/SignInPrompt';

export default function ProfilePage() {
  const { user, authenticated, ready } = useAuth();

  if (!ready) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated || !user) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-5xl mb-4">👤</p>
          <h2 className="text-2xl font-bold text-white mb-2">My Page</h2>
          <p className="mb-6" style={{ color: '#666' }}>Please sign in to view your profile</p>
          <SignInPrompt />
        </div>
      </div>
    );
  }

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  // VIP 상태 배지 (none이면 렌더 안 함)
  const vipBadge = user.vipStatus !== 'none' && (
    <span
      className="px-3 py-1 rounded-full text-xs font-bold"
      style={{
        background:
          user.vipStatus === 'approved'
            ? 'rgba(0,201,167,0.15)'
            : user.vipStatus === 'pending'
            ? 'rgba(245,166,35,0.15)'
            : 'rgba(136,136,136,0.15)',
        color:
          user.vipStatus === 'approved'
            ? '#00c9a7'
            : user.vipStatus === 'pending'
            ? '#f5a623'
            : '#888',
        border:
          user.vipStatus === 'approved'
            ? '1px solid rgba(0,201,167,0.3)'
            : user.vipStatus === 'pending'
            ? '1px solid rgba(245,166,35,0.3)'
            : '1px solid rgba(136,136,136,0.3)',
      }}
    >
      {user.vipStatus === 'approved' ? 'VIP' : user.vipStatus === 'pending' ? 'VIP review' : 'VIP revoked'}
    </span>
  );

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#080808' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 프로필 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center gap-6"
          style={{ background: '#111', border: '1px solid #1f1f1f' }}
        >
          {/* 아바타 */}
          <div
            className="w-20 h-20 rounded-2xl shrink-0 flex items-center justify-center text-2xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #6366f1, #00ff88)' }}
          >
            {initials}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-black text-white">{user.displayName || 'User'}</h1>
              {vipBadge}
            </div>

            <p className="text-sm mb-1" style={{ color: '#888' }}>
              {user.email}
            </p>

            {user.walletAddress && (
              <p className="font-mono text-sm mb-3" style={{ color: '#888' }}>
                {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
              </p>
            )}

            {/* 로그인 수단 표시 */}
            <div className="flex flex-wrap gap-2">
              {user.email && (
                <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: '#1f1f1f', color: '#888' }}>
                  Email
                </span>
              )}
              {user.walletAddress && (
                <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: '#1f1f1f', color: '#888' }}>
                  Wallet
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Trade History 섹션 */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Trade History</h2>
          <div className="text-center py-12 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            <p className="text-3xl mb-3">📊</p>
            <p className="text-white font-semibold mb-1">Your trades will appear here</p>
            <p className="text-sm" style={{ color: '#666' }}>
              On-chain settlement lands in Phase 3.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
