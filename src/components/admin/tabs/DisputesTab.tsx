'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate } from '../ui';

interface Dispute {
  id: string;
  trade_id: string;
  status: string;
  note: string | null;
  created_at: string;
}

export default function DisputesTab() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDisputes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ disputes: Dispute[] }>('/api/admin/disputes');
      setDisputes(data.disputes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadDisputes} />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Disputes</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: d => <span className="font-mono text-xs">{d.id.slice(0, 8)}...</span> },
          { key: 'trade', label: 'Trade ID', render: d => <span className="font-mono text-xs">{d.trade_id.slice(0, 8)}...</span> },
          { key: 'status', label: 'Status', render: d => <StatusChip status={d.status} /> },
          { key: 'note', label: 'Note', render: d => d.note || '—' },
          { key: 'created', label: 'Created', render: d => formatDate(d.created_at) },
        ]}
        data={disputes}
        keyExtractor={d => d.id}
        emptyText="No disputes"
      />
      <p className="text-sm mt-4" style={{ color: '#8FA398' }}>
        Detailed dispute resolution (evidence viewer + on-chain execution) coming in next iteration.
      </p>
    </div>
  );
}
