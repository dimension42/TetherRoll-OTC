'use client';

import { useState, useEffect } from 'react';
import { apiFetch, KpiTile, Loading, ErrorMessage, StatusChip } from '../ui';

interface Stats {
  totalUsers: number;
  vipPending: number;
  vipApproved: number;
  poolsOpen: number;
  poolsTotal: number;
  trades24h: number;
  trades7d: number;
  trades30d: number;
  feeRevenue24h: { chainId: number; symbol: string; totalFormatted: string }[];
  feeRevenue7d: { chainId: number; symbol: string; totalFormatted: string }[];
  feeRevenue30d: { chainId: number; symbol: string; totalFormatted: string }[];
  rollsInProgress: number;
  rollsFillingKrw: number;
  refundsPending: number;
  disputesOpen: number;
  indexerCursors: { chain_id: number; contract: string; last_block: number; updated_at: string }[];
  deployments: { chain_id: number; name: string; deployed_block: number }[];
  venues: { id: string; name: string; health_status: string; updated_at: string }[];
  killSwitchEnabled: boolean;
  activeAnnouncement: { id: string; text: string; level: string } | null;
}

export default function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ stats: Stats }>('/api/admin/stats');
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadStats} />;
  if (!stats) return null;

  const feeSum = (fees: { symbol: string; totalFormatted: string }[]) => {
    if (fees.length === 0) return '—';
    return fees.map(f => `${Number(f.totalFormatted).toFixed(4)} ${f.symbol}`).join(', ');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        {stats.killSwitchEnabled && (
          <div
            className="px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
            style={{ background: 'rgba(255,77,94,0.2)', border: '1px solid #FF4D5E', color: '#FF4D5E' }}
          >
            <span>🚨</span> KILL SWITCH ACTIVE
          </div>
        )}
      </div>

      {stats.activeAnnouncement && (
        <div
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{
            background: stats.activeAnnouncement.level === 'danger' ? 'rgba(255,77,94,0.1)' : stats.activeAnnouncement.level === 'warn' ? 'rgba(255,176,32,0.1)' : 'rgba(0,201,167,0.1)',
            border: `1px solid ${stats.activeAnnouncement.level === 'danger' ? '#FF4D5E' : stats.activeAnnouncement.level === 'warn' ? '#FFB020' : '#00c9a7'}40`,
          }}
        >
          <span className="text-xl">📢</span>
          <p className="text-sm" style={{ color: '#C8D5D0' }}>
            {stats.activeAnnouncement.text}
          </p>
        </div>
      )}

      <h2 className="text-lg font-bold text-white mb-4">Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiTile label="Total Users" value={stats.totalUsers} />
        <KpiTile label="VIP Approved" value={stats.vipApproved} color="#00c9a7" />
        <KpiTile label="VIP Pending" value={stats.vipPending} color={stats.vipPending > 0 ? '#FFB020' : '#8FA398'} warn={stats.vipPending > 0} />
        <KpiTile label="Pools Open" value={stats.poolsOpen} />
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Trades & Revenue</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="p-6 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-xs mb-2" style={{ color: '#8FA398' }}>24h Trades</p>
          <p className="text-3xl font-black mb-3" style={{ color: '#00c9a7', fontVariantNumeric: 'tabular-nums' }}>{stats.trades24h}</p>
          <p className="text-xs" style={{ color: '#8FA398' }}>Fee Revenue:</p>
          <p className="text-sm font-mono" style={{ color: '#C8D5D0' }}>{feeSum(stats.feeRevenue24h)}</p>
        </div>
        <div className="p-6 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-xs mb-2" style={{ color: '#8FA398' }}>7d Trades</p>
          <p className="text-3xl font-black mb-3" style={{ color: '#00c9a7', fontVariantNumeric: 'tabular-nums' }}>{stats.trades7d}</p>
          <p className="text-xs" style={{ color: '#8FA398' }}>Fee Revenue:</p>
          <p className="text-sm font-mono" style={{ color: '#C8D5D0' }}>{feeSum(stats.feeRevenue7d)}</p>
        </div>
        <div className="p-6 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-xs mb-2" style={{ color: '#8FA398' }}>30d Trades</p>
          <p className="text-3xl font-black mb-3" style={{ color: '#00c9a7', fontVariantNumeric: 'tabular-nums' }}>{stats.trades30d}</p>
          <p className="text-xs" style={{ color: '#8FA398' }}>Fee Revenue:</p>
          <p className="text-sm font-mono" style={{ color: '#C8D5D0' }}>{feeSum(stats.feeRevenue30d)}</p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Operations Board</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiTile label="Rolls in Progress" value={stats.rollsInProgress} icon="🎲" warn={stats.rollsInProgress > 0} />
        <KpiTile label="Rolls Filling KRW" value={`₩${stats.rollsFillingKrw.toLocaleString()}`} color="#FFB020" />
        <KpiTile label="Refunds Pending" value={stats.refundsPending} color={stats.refundsPending > 0 ? '#FFB020' : '#8FA398'} warn={stats.refundsPending > 0} />
        <KpiTile label="Disputes Open" value={stats.disputesOpen} color={stats.disputesOpen > 0 ? '#FF4D5E' : '#00c9a7'} warn={stats.disputesOpen > 0} />
      </div>

      <h2 className="text-lg font-bold text-white mb-4">System Health</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: '#8FA398' }}>Indexer Status</h3>
          {stats.indexerCursors.length === 0 ? (
            <p className="text-sm" style={{ color: '#8FA398' }}>No indexer cursors</p>
          ) : (
            <div className="space-y-2">
              {stats.indexerCursors.map(c => {
                const deploy = stats.deployments.find(d => d.chain_id === c.chain_id && d.name === c.contract);
                const lag = deploy ? c.last_block - deploy.deployed_block : 0;
                return (
                  <div key={`${c.chain_id}:${c.contract}`} className="flex justify-between text-sm">
                    <span style={{ color: '#C8D5D0' }}>
                      Chain {c.chain_id} / {c.contract}
                    </span>
                    <span className="font-mono" style={{ color: '#8FA398' }}>
                      Block {c.last_block.toLocaleString()} (lag: {lag})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: '#8FA398' }}>Venue Health</h3>
          {stats.venues.length === 0 ? (
            <p className="text-sm" style={{ color: '#8FA398' }}>No venues enabled</p>
          ) : (
            <div className="space-y-2">
              {stats.venues.map(v => (
                <div key={v.id} className="flex justify-between items-center text-sm">
                  <span style={{ color: '#C8D5D0' }}>{v.name}</span>
                  <StatusChip status={v.health_status.toUpperCase()} label={v.health_status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
