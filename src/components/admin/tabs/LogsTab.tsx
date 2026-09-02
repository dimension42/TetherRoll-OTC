'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, formatDate, jsonSummary } from '../ui';

interface AuditLog {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
  users: {
    email: string | null;
    display_name: string | null;
  };
}

export default function LogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ logs: AuditLog[] }>('/api/admin/audit-logs');
      setLogs(data.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadLogs} />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Audit Logs</h1>
      <DataTable
        columns={[
          { key: 'admin', label: 'Admin', render: l => l.users.display_name || l.users.email || 'System' },
          { key: 'action', label: 'Action', render: l => <span className="font-mono text-xs">{l.action}</span> },
          { key: 'target', label: 'Target', render: l => l.target_type ? `${l.target_type}:${l.target_id?.slice(0, 8)}` : '—' },
          { key: 'before', label: 'Before', render: l => <span className="font-mono text-xs">{jsonSummary(l.before)}</span> },
          { key: 'after', label: 'After', render: l => <span className="font-mono text-xs">{jsonSummary(l.after)}</span> },
          { key: 'when', label: 'When', render: l => formatDate(l.created_at) },
        ]}
        data={logs}
        keyExtractor={l => l.id}
        emptyText="No audit logs"
      />
    </div>
  );
}
