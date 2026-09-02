'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate } from '../ui';
import { txUrl } from '@/lib/chains';

interface Trade {
  id: string;
  kind: string;
  status: string;
  chain_id: number;
  taker_address: string | null;
  maker_address: string | null;
  tx_hash: string | null;
  created_at: string;
}

export default function TradesTab() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTrades = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ trades: Trade[] }>('/api/admin/trades');
      setTrades(data.trades);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadTrades} />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Trades</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: t => <span className="font-mono text-xs">{t.id.slice(0, 8)}...</span> },
          { key: 'kind', label: 'Kind', render: t => t.kind },
          { key: 'chain', label: 'Chain', render: t => `Chain ${t.chain_id}` },
          { key: 'status', label: 'Status', render: t => <StatusChip status={t.status} /> },
          { key: 'maker', label: 'Maker', render: t => <span className="font-mono text-xs">{t.maker_address?.slice(0, 10)}...</span> },
          { key: 'taker', label: 'Taker', render: t => <span className="font-mono text-xs">{t.taker_address?.slice(0, 10)}...</span> },
          {
            key: 'tx',
            label: 'TX',
            render: t => t.tx_hash ? (
              <a
                href={txUrl(t.chain_id, t.tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: '#00c9a7' }}
              >
                View
              </a>
            ) : '—',
          },
          { key: 'created', label: 'Created', render: t => formatDate(t.created_at) },
        ]}
        data={trades}
        keyExtractor={t => t.id}
        emptyText="No trades"
      />
    </div>
  );
}
