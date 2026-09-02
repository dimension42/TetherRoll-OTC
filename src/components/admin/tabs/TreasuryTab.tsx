'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate } from '../ui';

interface Transfer {
  id: string;
  chain_id: number;
  from_wallet: string;
  to_address: string;
  amount: string;
  token: string;
  status: string;
  requested_by: string;
  approved_by: string | null;
  tx_hash: string | null;
  created_at: string;
}

interface WhitelistEntry {
  id: string;
  address: string;
  label: string;
  chain_id: number | null;
  created_at: string;
}

export default function TreasuryTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [t, w] = await Promise.all([
        apiFetch<{ transfers: Transfer[] }>('/api/admin/treasury/transfers'),
        apiFetch<{ whitelist: WhitelistEntry[] }>('/api/admin/whitelist'),
      ]);
      setTransfers(t.transfers);
      setWhitelist(w.whitelist);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this transfer?')) return;
    try {
      await apiFetch(`/api/admin/treasury/transfers/${id}/approve`, { method: 'POST' });
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approval failed');
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadData} />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Treasury</h1>

      <h2 className="text-lg font-bold text-white mb-4">Whitelist ({whitelist.length})</h2>
      <div className="mb-8">
        <DataTable
          columns={[
            { key: 'address', label: 'Address', render: w => <span className="font-mono text-sm">{w.address}</span> },
            { key: 'label', label: 'Label', render: w => w.label },
            { key: 'chain', label: 'Chain', render: w => w.chain_id ? `Chain ${w.chain_id}` : 'All' },
            { key: 'created', label: 'Added', render: w => formatDate(w.created_at) },
          ]}
          data={whitelist}
          keyExtractor={w => w.id}
          emptyText="No whitelisted addresses"
        />
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Transfer History ({transfers.length})</h2>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: t => <span className="font-mono text-xs">{t.id.slice(0, 8)}...</span> },
          { key: 'chain', label: 'Chain', render: t => `Chain ${t.chain_id}` },
          { key: 'to', label: 'To', render: t => <span className="font-mono text-xs">{t.to_address.slice(0, 10)}...</span> },
          { key: 'amount', label: 'Amount', render: t => `${t.amount} ${t.token}`, mono: true },
          { key: 'status', label: 'Status', render: t => <StatusChip status={t.status} /> },
          { key: 'created', label: 'Created', render: t => formatDate(t.created_at) },
          {
            key: 'actions',
            label: 'Actions',
            render: t => (
              t.status === 'REQUESTED' ? (
                <button
                  onClick={() => handleApprove(t.id)}
                  className="px-3 py-1 rounded text-xs font-bold"
                  style={{ background: '#00c9a7', color: '#050806' }}
                >
                  Approve
                </button>
              ) : '—'
            ),
          },
        ]}
        data={transfers}
        keyExtractor={t => t.id}
        emptyText="No transfers"
      />

      <p className="text-sm mt-4" style={{ color: '#8FA398' }}>
        Transfer request + 2-person approval + execution flow coming in next iteration.
      </p>
    </div>
  );
}
