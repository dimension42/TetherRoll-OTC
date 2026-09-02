'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';
import { shortAddr } from '@/lib/format';
import { StatusChip } from '@/components/ui/StatusChip';
import { AddressLink } from '@/components/ui/AddressLink';
import Link from 'next/link';

interface Wallet {
  address: string;
  source: string;
  is_primary: boolean;
  created_at: string;
}

interface Trade {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  pool?: { offer_symbol: string; request_symbol: string };
}

export default function ProfilePage() {
  const { user, authenticated, ready, logout, refresh } = useAuth();
  const { address: connectedAddress } = useAccount();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authenticated) {
      loadWallets();
      loadTrades();
    }
  }, [authenticated]);

  const loadWallets = async () => {
    setLoadingWallets(true);
    try {
      const res = await fetch('/api/wallets');
      if (res.ok) {
        const data = await res.json();
        setWallets(data.wallets || []);
      }
    } catch (err) {
      console.error('Failed to load wallets:', err);
    } finally {
      setLoadingWallets(false);
    }
  };

  const loadTrades = async () => {
    setLoadingTrades(true);
    try {
      const res = await fetch('/api/trades/mine');
      if (res.ok) {
        const data = await res.json();
        setTrades((data.trades || []).slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to load trades:', err);
    } finally {
      setLoadingTrades(false);
    }
  };

  const handleUnlink = async (address: string) => {
    if (!confirm(`Unlink wallet ${shortAddr(address)}?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/wallets/${address}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unlink wallet');
      }
      await loadWallets();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink wallet');
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('Sign out from all devices? This will invalidate all active sessions.')) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout-all', { method: 'POST' });
      await logout();
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#050806' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated || !user) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center grid-bg" style={{ background: '#050806' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-5xl mb-4">👤</p>
          <h2 className="text-2xl font-bold text-white mb-2">Profile</h2>
          <p className="mb-6" style={{ color: '#666' }}>Please sign in to view your profile</p>
          <Link href="/login" className="btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const initials = user.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div
          className="p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center gap-6"
          style={{ background: '#111', border: '1px solid #1f1f1f' }}
        >
          <div
            className="w-20 h-20 rounded-2xl shrink-0 flex items-center justify-center text-2xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #6366f1, #00ff88)' }}
          >
            {initials}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-black text-white">{user.displayName || 'User'}</h1>
              {user.vipStatus === 'approved' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7', border: '1px solid rgba(0,201,167,0.3)' }}
                >
                  VIP
                </span>
              )}
              {user.isAdmin && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(255,77,94,0.15)', color: '#FF4D5E', border: '1px solid rgba(255,77,94,0.3)' }}
                >
                  Admin
                </span>
              )}
            </div>

            {user.email && (
              <p className="text-sm mb-1" style={{ color: '#888' }}>
                {user.email}
              </p>
            )}

            <button
              onClick={handleLogoutAll}
              disabled={busy}
              className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,77,94,0.1)', color: '#FF4D5E', border: '1px solid rgba(255,77,94,0.2)' }}
            >
              {busy ? 'Signing out...' : 'Sign Out Everywhere'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.2)' }}>
            <p className="text-sm" style={{ color: '#FF4D5E' }}>⚠️ {error}</p>
          </div>
        )}

        {/* Wallets */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Connected Wallets</h2>
          <div
            className="rounded-2xl p-6"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}
          >
            {loadingWallets ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
              </div>
            ) : wallets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: '#666' }}>
                  No wallets linked yet.{connectedAddress && ` Connect wallet ${shortAddr(connectedAddress)} to link it.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {wallets.map(w => (
                  <div
                    key={w.address}
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{ background: '#0d0d0d', border: w.is_primary ? '1px solid rgba(0,201,167,0.2)' : '1px solid transparent' }}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono text-sm text-white">{shortAddr(w.address, 10, 8)}</p>
                        {w.is_primary && (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                          >
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: '#666' }}>
                        {w.source} • Added {new Date(w.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!w.is_primary && (
                      <button
                        onClick={() => handleUnlink(w.address)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(255,77,94,0.1)', color: '#FF4D5E', cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Trades */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Trades</h2>
            <Link href="/trades" className="text-sm font-semibold" style={{ color: '#00c9a7' }}>
              View All →
            </Link>
          </div>
          <div
            className="rounded-2xl p-6"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}
          >
            {loadingTrades ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-3">📊</p>
                <p className="text-white font-semibold mb-1">No trades yet</p>
                <p className="text-sm mb-4" style={{ color: '#666' }}>
                  Create a pool or take an existing one to start trading
                </p>
                <Link href="/pools/create" className="btn-primary inline-flex">
                  + Create Pool
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {trades.map(t => (
                  <Link
                    key={t.id}
                    href={`/trades/${t.id}`}
                    className="block p-4 rounded-xl transition-all hover:bg-white/5"
                    style={{ background: '#0d0d0d' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white">
                        {t.pool ? `${t.pool.offer_symbol} ↔ ${t.pool.request_symbol}` : `Trade #${t.id.slice(0, 8)}`}
                      </p>
                      <StatusChip status={t.status} type="trade" />
                    </div>
                    <p className="text-xs" style={{ color: '#666' }}>
                      {t.kind} • {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
