'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate } from '../ui';

interface Pool {
  id: string;
  status: string;
  visibility: string;
  trade_type: string;
  offer_symbol: string;
  request_symbol: string;
  offer_amount: string;
  created_at: string;
  creator_id: string;
}

export default function PoolsTab() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPools = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ pools: Pool[] }>('/api/admin/pools');
      setPools(data.pools);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPools();
  }, []);

  const handleHide = async (id: string) => {
    if (!confirm('Hide this pool?')) return;
    try {
      await apiFetch('/api/admin/pools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'hide', reason: 'Admin hidden' }),
      });
      await loadPools();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to hide pool');
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadPools} />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Pools Management</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: p => <span className="font-mono text-xs">{p.id.slice(0, 8)}...</span> },
          { key: 'type', label: 'Type', render: p => p.trade_type },
          { key: 'offer', label: 'Offer', render: p => `${Number(p.offer_amount).toFixed(2)} ${p.offer_symbol}`, mono: true },
          { key: 'request', label: 'Request', render: p => p.request_symbol },
          { key: 'visibility', label: 'Visibility', render: p => <StatusChip status={p.visibility.toUpperCase()} /> },
          { key: 'status', label: 'Status', render: p => <StatusChip status={p.status} /> },
          { key: 'created', label: 'Created', render: p => formatDate(p.created_at) },
          {
            key: 'actions',
            label: 'Actions',
            render: p => (
              p.status !== 'HIDDEN' ? (
                <button
                  onClick={() => handleHide(p.id)}
                  className="px-3 py-1 rounded text-xs font-bold"
                  style={{ background: '#FF4D5E40', color: '#FF4D5E', border: '1px solid #FF4D5E' }}
                >
                  Hide
                </button>
              ) : <span style={{ color: '#8FA398' }}>—</span>
            ),
          },
        ]}
        data={pools}
        keyExtractor={p => p.id}
        emptyText="No pools"
      />
    </div>
  );
}
