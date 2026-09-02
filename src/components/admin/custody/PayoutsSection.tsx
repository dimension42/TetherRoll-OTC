'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, Drawer, StatusChip, formatDate } from '../ui';

interface Payout {
  id: string;
  trade_id: string;
  to_address: string;
  amount: string;
  purpose: string;
  needs_approval: boolean;
  status: string;
  tx_hash: string | null;
  reject_reason: string | null;
  note: string | null;
  created_at: string;
  executed_at: string | null;
  asset: { id: string; symbol: string; chain_key: string; decimals: number; explorer_tx_url: string | null };
  trade: { id: string; kind: string; status: string };
  requester: { id: string; email: string | null } | null;
  approver: { id: string; email: string | null } | null;
  executor: { id: string; email: string | null } | null;
}

export default function PayoutsSection() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [execTxHash, setExecTxHash] = useState('');
  const [execNote, setExecNote] = useState('');

  const loadPayouts = async () => {
    setLoading(true);
    setError('');
    try {
      const url = filter ? `/api/admin/custody/payouts?status=${filter}` : '/api/admin/custody/payouts';
      const data = await apiFetch<{ payouts: Payout[] }>(url);
      setPayouts(data.payouts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, [filter]);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this payout?')) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/custody/payouts/${id}/approve`, { method: 'POST' });
      await loadPayouts();
      if (selectedPayout?.id === id) {
        const data = await apiFetch<{ payouts: Payout[] }>('/api/admin/custody/payouts');
        const updated = data.payouts.find(p => p.id === id);
        if (updated) setSelectedPayout(updated);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/custody/payouts/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      await loadPayouts();
      if (selectedPayout?.id === id) setSelectedPayout(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedPayout || !execTxHash.trim()) {
      alert('TX hash required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ payout: Payout; verified: boolean }>(`/api/admin/custody/payouts/${selectedPayout.id}/executed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: execTxHash, note: execNote || undefined }),
      });
      alert(res.verified ? 'Payout executed and verified on-chain!' : 'Payout executed (verification pending)');
      setSelectedPayout(null);
      setExecTxHash('');
      setExecNote('');
      await loadPayouts();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Execute failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatAmount = (amount: string, decimals: number) => {
    const num = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    const frac = num % divisor;
    return `${whole.toLocaleString()}.${frac.toString().padStart(decimals, '0')}`;
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadPayouts} />;

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
          onClick={() => setFilter('REQUESTED')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'REQUESTED' ? '#00c9a7' : '#111',
            color: filter === 'REQUESTED' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'REQUESTED' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Requested
        </button>
        <button
          onClick={() => setFilter('APPROVED')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'APPROVED' ? '#00c9a7' : '#111',
            color: filter === 'APPROVED' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'APPROVED' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Approved
        </button>
        <button
          onClick={() => setFilter('EXECUTED')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'EXECUTED' ? '#00c9a7' : '#111',
            color: filter === 'EXECUTED' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'EXECUTED' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Executed
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'trade', label: 'Trade ID', render: p => <span className="font-mono text-xs">{p.trade_id.slice(0, 8)}...</span> },
          { key: 'asset', label: 'Asset', render: p => `${p.asset.symbol} (${p.asset.chain_key})` },
          { key: 'to', label: 'To Address', render: p => <span className="font-mono text-xs">{p.to_address.slice(0, 12)}...</span> },
          { key: 'amount', label: 'Amount', render: p => formatAmount(p.amount, p.asset.decimals), mono: true },
          { key: 'purpose', label: 'Purpose', render: p => <StatusChip status={p.purpose} label={p.purpose} /> },
          { key: '2p', label: '2P?', render: p => p.needs_approval ? 'Yes' : 'No' },
          { key: 'status', label: 'Status', render: p => <StatusChip status={p.status} /> },
          { key: 'created', label: 'Created', render: p => formatDate(p.created_at) },
          {
            key: 'actions',
            label: 'Actions',
            render: p => (
              <button
                onClick={() => setSelectedPayout(p)}
                className="px-3 py-1 rounded text-xs font-bold"
                style={{ background: '#00c9a740', color: '#00c9a7' }}
              >
                View
              </button>
            ),
          },
        ]}
        data={payouts}
        keyExtractor={p => p.id}
        emptyText="No payouts"
      />

      {/* Payout detail drawer */}
      {selectedPayout && (
        <Drawer isOpen={true} onClose={() => setSelectedPayout(null)} title="Payout Detail" width="700px">
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Trade & Purpose</h3>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Trade ID: <a href={`/trades/${selectedPayout.trade_id}`} className="font-mono text-white underline">{selectedPayout.trade_id}</a>
              </p>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Purpose: <StatusChip status={selectedPayout.purpose} label={selectedPayout.purpose} />
              </p>
              <p className="text-xs" style={{ color: '#8FA398' }}>
                Status: <StatusChip status={selectedPayout.status} />
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Payout Details</h3>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Asset: {selectedPayout.asset.symbol} ({selectedPayout.asset.chain_key})
              </p>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                To Address: <span className="font-mono text-white break-all">{selectedPayout.to_address}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(selectedPayout.to_address)}
                  className="ml-2 px-2 py-1 rounded text-xs"
                  style={{ background: '#00c9a740', color: '#00c9a7' }}
                >
                  Copy
                </button>
              </p>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Amount: <span className="font-mono font-bold text-white">
                  {formatAmount(selectedPayout.amount, selectedPayout.asset.decimals)} {selectedPayout.asset.symbol}
                </span>
              </p>
              <p className="text-xs" style={{ color: '#8FA398' }}>
                Needs Approval: {selectedPayout.needs_approval ? 'Yes (2-person)' : 'No'}
              </p>
            </div>

            {(selectedPayout.requester || selectedPayout.approver || selectedPayout.executor) && (
              <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Workflow</h3>
                {selectedPayout.requester && (
                  <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                    Requester: {selectedPayout.requester.email || selectedPayout.requester.id}
                  </p>
                )}
                {selectedPayout.approver && (
                  <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                    Approver: {selectedPayout.approver.email || selectedPayout.approver.id}
                  </p>
                )}
                {selectedPayout.executor && (
                  <p className="text-xs" style={{ color: '#8FA398' }}>
                    Executor: {selectedPayout.executor.email || selectedPayout.executor.id}
                  </p>
                )}
              </div>
            )}

            {selectedPayout.tx_hash && (
              <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Transaction</h3>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                  TX Hash: <span className="font-mono text-white">{selectedPayout.tx_hash}</span>
                </p>
                {selectedPayout.asset.explorer_tx_url && (
                  <a
                    href={selectedPayout.asset.explorer_tx_url.replace('{hash}', selectedPayout.tx_hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    style={{ color: '#00c9a7' }}
                  >
                    View on Explorer →
                  </a>
                )}
              </div>
            )}

            {selectedPayout.note && (
              <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <h3 className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Note</h3>
                <p className="text-xs" style={{ color: '#C8D5D0' }}>{selectedPayout.note}</p>
              </div>
            )}

            {selectedPayout.reject_reason && (
              <div className="p-4 rounded-lg" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid #FF4D5E40' }}>
                <h3 className="text-sm font-bold mb-2" style={{ color: '#FF4D5E' }}>Rejection Reason</h3>
                <p className="text-xs" style={{ color: '#FF4D5E' }}>{selectedPayout.reject_reason}</p>
              </div>
            )}

            {/* Actions */}
            {selectedPayout.status === 'REQUESTED' && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(selectedPayout.id)}
                  disabled={submitting || (selectedPayout.needs_approval && selectedPayout.requester?.id === 'current-admin-id')}
                  className="flex-1 px-4 py-3 rounded-lg font-bold"
                  style={{
                    background: '#00c9a7',
                    color: '#fff',
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(selectedPayout.id)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-lg font-bold"
                  style={{ background: '#FF4D5E', color: '#fff', opacity: submitting ? 0.5 : 1 }}
                >
                  Reject
                </button>
              </div>
            )}

            {(selectedPayout.status === 'APPROVED' || (selectedPayout.status === 'REQUESTED' && !selectedPayout.needs_approval)) && (
              <div className="space-y-3 pt-4 border-t" style={{ borderColor: '#1f1f1f' }}>
                <h3 className="text-sm font-bold" style={{ color: '#fff' }}>Execute Payout</h3>
                <p className="text-xs" style={{ color: '#8FA398' }}>
                  After sending the transaction on-chain, paste the TX hash here:
                </p>
                <input
                  type="text"
                  value={execTxHash}
                  onChange={e => setExecTxHash(e.target.value)}
                  placeholder="0x... or txhash"
                  className="w-full px-4 py-2 rounded-lg text-sm font-mono"
                  style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                />
                <textarea
                  value={execNote}
                  onChange={e => setExecNote(e.target.value)}
                  placeholder="Optional note..."
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg text-sm"
                  style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                />
                <button
                  onClick={handleExecute}
                  disabled={!execTxHash.trim() || submitting}
                  className="w-full px-4 py-3 rounded-lg font-bold"
                  style={{
                    background: '#00c9a7',
                    color: '#fff',
                    opacity: !execTxHash.trim() || submitting ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Executing...' : 'Record Execution'}
                </button>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
