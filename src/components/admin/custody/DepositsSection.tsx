'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, Drawer, StatusChip, formatDate, ConfirmDialog } from '../ui';

interface Leg {
  id: string;
  trade_id: string;
  side: string;
  status: string;
  kind: string;
  amount: string;
  amount_with_suffix: string | null;
  tx_hash: string | null;
  confirmations: number;
  note: string | null;
  created_at: string;
  trade: { id: string; kind: string; status: string };
  owner: { id: string; email: string | null; wallet_address: string | null };
  asset: { id: string; symbol: string; chain_key: string; chain_name: string; decimals: number; explorer_tx_url: string | null } | null;
}

export default function DepositsSection() {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [selectedLeg, setSelectedLeg] = useState<Leg | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [failDialog, setFailDialog] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadLegs = async () => {
    setLoading(true);
    setError('');
    try {
      const url = filter ? `/api/admin/custody/legs?status=${filter}` : '/api/admin/custody/legs';
      const data = await apiFetch<{ legs: Leg[] }>(url);
      // Filter CRYPTO legs only (deposits)
      const cryptoLegs = data.legs.filter(l => l.kind === 'CRYPTO');
      setLegs(cryptoLegs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load legs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLegs();
  }, [filter]);

  const handleConfirm = async () => {
    if (!selectedLeg) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/custody/legs/${selectedLeg.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: txHash || undefined, note: note || undefined }),
      });
      setConfirmDialog(false);
      setSelectedLeg(null);
      setTxHash('');
      setNote('');
      await loadLegs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFail = async () => {
    if (!selectedLeg || !note.trim()) {
      alert('Note is required to fail a leg');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/custody/legs/${selectedLeg.id}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      setFailDialog(false);
      setSelectedLeg(null);
      setNote('');
      await loadLegs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fail failed');
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
  if (error) return <ErrorMessage error={error} onRetry={loadLegs} />;

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
          onClick={() => setFilter('SUBMITTED')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'SUBMITTED' ? '#00c9a7' : '#111',
            color: filter === 'SUBMITTED' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'SUBMITTED' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Submitted
        </button>
        <button
          onClick={() => setFilter('CONFIRMING')}
          className="px-3 py-2 rounded-lg text-sm font-bold"
          style={{
            background: filter === 'CONFIRMING' ? '#00c9a7' : '#111',
            color: filter === 'CONFIRMING' ? '#050806' : '#8FA398',
            border: `1px solid ${filter === 'CONFIRMING' ? '#00c9a7' : '#1f1f1f'}`,
          }}
        >
          Confirming
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
      </div>

      <DataTable
        columns={[
          { key: 'trade', label: 'Trade ID', render: l => <span className="font-mono text-xs">{l.trade_id.slice(0, 8)}...</span> },
          { key: 'asset', label: 'Asset', render: l => l.asset ? `${l.asset.symbol} (${l.asset.chain_key})` : 'N/A' },
          { key: 'owner', label: 'Owner', render: l => l.owner.email || l.owner.wallet_address?.slice(0, 10) || 'N/A' },
          { key: 'amount', label: 'Expected Amount', render: l => l.asset ? formatAmount(l.amount, l.asset.decimals) : l.amount, mono: true },
          { key: 'tx', label: 'TX Hash', render: l => l.tx_hash ? <span className="font-mono text-xs">{l.tx_hash.slice(0, 10)}...</span> : '—' },
          { key: 'confirms', label: 'Confirmations', render: l => l.confirmations, mono: true },
          { key: 'status', label: 'Status', render: l => <StatusChip status={l.status} /> },
          { key: 'created', label: 'Created', render: l => formatDate(l.created_at) },
          {
            key: 'actions',
            label: 'Actions',
            render: l => (
              <button
                onClick={() => setSelectedLeg(l)}
                className="px-3 py-1 rounded text-xs font-bold"
                style={{ background: '#00c9a740', color: '#00c9a7' }}
              >
                View
              </button>
            ),
          },
        ]}
        data={legs}
        keyExtractor={l => l.id}
        emptyText="No deposit legs"
      />

      {/* Leg detail drawer */}
      {selectedLeg && (
        <Drawer isOpen={true} onClose={() => setSelectedLeg(null)} title="Deposit Detail" width="700px">
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Trade & Owner</h3>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Trade ID: <a href={`/trades/${selectedLeg.trade_id}`} className="font-mono text-white underline">{selectedLeg.trade_id}</a>
              </p>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Owner: {selectedLeg.owner.email || selectedLeg.owner.wallet_address || 'N/A'}
              </p>
              <p className="text-xs" style={{ color: '#8FA398' }}>
                Status: <StatusChip status={selectedLeg.status} />
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Asset & Amount</h3>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Asset: {selectedLeg.asset ? `${selectedLeg.asset.symbol} (${selectedLeg.asset.chain_key})` : 'N/A'}
              </p>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                Expected Amount: <span className="font-mono font-bold text-white">
                  {selectedLeg.asset ? formatAmount(selectedLeg.amount, selectedLeg.asset.decimals) : selectedLeg.amount}
                </span>
              </p>
              {selectedLeg.amount_with_suffix && (
                <p className="text-xs" style={{ color: '#FFB020' }}>
                  With Suffix: <span className="font-mono font-bold">{selectedLeg.amount_with_suffix}</span>
                </p>
              )}
            </div>

            {selectedLeg.tx_hash && (
              <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Transaction</h3>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                  TX Hash: <span className="font-mono text-white">{selectedLeg.tx_hash}</span>
                </p>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>
                  Confirmations: <span className="font-mono text-white">{selectedLeg.confirmations}</span>
                </p>
                {selectedLeg.asset?.explorer_tx_url && (
                  <a
                    href={selectedLeg.asset.explorer_tx_url.replace('{hash}', selectedLeg.tx_hash)}
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

            {selectedLeg.note && (
              <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <h3 className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Note</h3>
                <p className="text-xs" style={{ color: '#C8D5D0' }}>{selectedLeg.note}</p>
              </div>
            )}

            {(selectedLeg.status === 'SUBMITTED' || selectedLeg.status === 'CONFIRMING' || selectedLeg.status === 'PENDING') && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setConfirmDialog(true); setTxHash(selectedLeg.tx_hash || ''); }}
                  className="flex-1 px-4 py-3 rounded-lg font-bold"
                  style={{ background: '#00c9a7', color: '#fff' }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setFailDialog(true)}
                  className="flex-1 px-4 py-3 rounded-lg font-bold"
                  style={{ background: '#FF4D5E', color: '#fff' }}
                >
                  Fail
                </button>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => { setConfirmDialog(false); setTxHash(''); setNote(''); }}
        onConfirm={handleConfirm}
        title="Confirm Deposit"
        message="Verify that the deposit transaction is correct and has sufficient confirmations."
        confirmText="Confirm"
        confirmColor="#00c9a7"
        requireTypedConfirm="CONFIRM"
      />

      {/* Fail dialog */}
      {failDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setFailDialog(false)}
        >
          <div
            className="max-w-md w-full rounded-2xl p-6"
            style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">Fail Deposit</h3>
            <p className="text-sm mb-4" style={{ color: '#C8D5D0' }}>
              This will mark the deposit as failed. Provide a reason:
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 rounded-lg text-sm mb-4"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              placeholder="e.g., Insufficient amount, wrong address..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setFailDialog(false); setNote(''); }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: '#111', color: '#fff', border: '1px solid #1f1f1f' }}
              >
                Cancel
              </button>
              <button
                onClick={handleFail}
                disabled={!note.trim() || submitting}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-bold"
                style={{
                  background: '#FF4D5E',
                  color: '#fff',
                  opacity: !note.trim() || submitting ? 0.5 : 1,
                }}
              >
                {submitting ? 'Failing...' : 'Fail Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
