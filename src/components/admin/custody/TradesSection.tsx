'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate } from '../ui';

interface Trade {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  seller: { id: string; email: string | null; wallet_address: string | null };
  buyer: { id: string; email: string | null; wallet_address: string | null };
  legs: Array<{
    id: string;
    side: string;
    kind: string;
    status: string;
    asset: { symbol: string; chain_key: string } | null;
  }>;
}

export default function TradesSection() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('');

  const loadTrades = async () => {
    setLoading(true);
    setError('');
    try {
      const url = filter ? `/api/admin/custody/trades?status=${filter}` : '/api/admin/custody/trades';
      const data = await apiFetch<{ trades: Trade[] }>(url);
      setTrades(data.trades);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, [filter]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadTrades} />;

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter('')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === '' ? '#00c9a7' : '#111',
            color: filter === '' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === '' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          All
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'PENDING' ? '#00c9a7' : '#111',
            color: filter === 'PENDING' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'PENDING' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('AWAITING_DEPOSITS')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'AWAITING_DEPOSITS' ? '#00c9a7' : '#111',
            color: filter === 'AWAITING_DEPOSITS' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'AWAITING_DEPOSITS' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Awaiting Deposits
        </button>
        <button
          onClick={() => setFilter('DEPOSITED')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'DEPOSITED' ? '#00c9a7' : '#111',
            color: filter === 'DEPOSITED' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'DEPOSITED' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Deposited
        </button>
        <button
          onClick={() => setFilter('PAYOUT_PENDING')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'PAYOUT_PENDING' ? '#00c9a7' : '#111',
            color: filter === 'PAYOUT_PENDING' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'PAYOUT_PENDING' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Payout Pending
        </button>
        <button
          onClick={() => setFilter('COMPLETED')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'COMPLETED' ? '#00c9a7' : '#111',
            color: filter === 'COMPLETED' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'COMPLETED' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Completed
        </button>
      </div>

      <DataTable
        columns={[
          {
            key: 'id',
            label: 'Trade ID',
            render: t => (
              <a href={`/trades/${t.id}`} className="font-mono text-xs underline" style={{ color: '#00c9a7' }}>
                {t.id.slice(0, 8)}...
              </a>
            ),
          },
          { key: 'seller', label: 'Seller', render: t => t.seller.email || t.seller.wallet_address?.slice(0, 10) || 'N/A' },
          { key: 'buyer', label: 'Buyer', render: t => t.buyer.email || t.buyer.wallet_address?.slice(0, 10) || 'N/A' },
          {
            key: 'legs',
            label: 'Legs',
            render: t => (
              <div className="flex gap-1">
                {t.legs.map((leg, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: '#111', border: '1px solid #1f1f1f' }}
                  >
                    {leg.asset ? `${leg.asset.symbol}` : leg.kind}
                    <span className="ml-1" style={{ color: leg.status === 'CONFIRMED' ? '#00c9a7' : '#FFB020' }}>
                      ({leg.status})
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
          { key: 'status', label: 'Status', render: t => <StatusChip status={t.status} /> },
          { key: 'created', label: 'Created', render: t => formatDate(t.created_at) },
        ]}
        data={trades}
        keyExtractor={t => t.id}
        emptyText="No DESK trades"
      />
    </div>
  );
}
