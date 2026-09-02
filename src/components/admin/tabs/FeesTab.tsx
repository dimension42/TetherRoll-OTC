'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, formatDate } from '../ui';

interface FeeConfig {
  id: string;
  key: string;
  value: number;
  venue_id: string | null;
  changed_by: string | null;
  changed_at: string;
}

export default function FeesTab() {
  const [fees, setFees] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFees = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ fees: FeeConfig[] }>('/api/admin/fees');
      setFees(data.fees);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFees();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadFees} />;

  const latestByKey: Record<string, FeeConfig> = {};
  for (const f of fees) {
    if (!latestByKey[f.key] || new Date(f.changed_at) > new Date(latestByKey[f.key].changed_at)) {
      latestByKey[f.key] = f;
    }
  }
  const current = Object.values(latestByKey);

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Fee Configuration</h1>

      <h2 className="text-lg font-bold text-white mb-4">Current Config</h2>
      <div className="mb-8">
        <DataTable
          columns={[
            { key: 'key', label: 'Key', render: f => <span className="font-mono text-sm">{f.key}</span> },
            { key: 'value', label: 'Value', render: f => f.value.toString(), mono: true },
            { key: 'venue', label: 'Venue', render: f => f.venue_id || 'Global' },
            { key: 'changed', label: 'Last Changed', render: f => formatDate(f.changed_at) },
          ]}
          data={current}
          keyExtractor={f => f.key}
          emptyText="No fee config"
        />
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Full History ({fees.length})</h2>
      <DataTable
        columns={[
          { key: 'key', label: 'Key', render: f => <span className="font-mono text-xs">{f.key}</span> },
          { key: 'value', label: 'Value', render: f => f.value.toString(), mono: true },
          { key: 'changed', label: 'Changed At', render: f => formatDate(f.changed_at) },
        ]}
        data={fees}
        keyExtractor={f => f.id}
        emptyText="No history"
      />

      <p className="text-sm mt-4" style={{ color: '#8FA398' }}>
        Fee update form + on-chain setFees integration coming in next iteration.
      </p>
    </div>
  );
}
