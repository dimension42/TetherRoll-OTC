'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate, Drawer } from '../ui';
import { SUPPORTED_CHAINS, CHAIN_META } from '@/lib/chains';
import { tokensFor } from '@/lib/tokens';
import { isAddress } from 'viem';

interface Transfer {
  id: string;
  chain_id: number;
  from_wallet: string;
  to_address: string;
  amount: string;
  token: string;
  note: string | null;
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
  const [showWhitelistAdd, setShowWhitelistAdd] = useState(false);
  const [showTransferRequest, setShowTransferRequest] = useState(false);
  const [showExecute, setShowExecute] = useState<Transfer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Whitelist add form
  const [wlAddress, setWlAddress] = useState('');
  const [wlLabel, setWlLabel] = useState('');
  const [wlChainId, setWlChainId] = useState<number | null>(null);

  // Transfer request form
  const [trChainId, setTrChainId] = useState<number>(11155111);
  const [trFromWallet, setTrFromWallet] = useState('');
  const [trToAddress, setTrToAddress] = useState('');
  const [trToken, setTrToken] = useState('');
  const [trAmount, setTrAmount] = useState('');
  const [trNote, setTrNote] = useState('');
  const [trConfirmAddress, setTrConfirmAddress] = useState('');
  const [trConfirmAmount, setTrConfirmAmount] = useState('');

  // Execute form
  const [execTxHash, setExecTxHash] = useState('');

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

  const handleWhitelistAdd = async () => {
    if (!wlAddress.trim() || !wlLabel.trim()) {
      alert('Address and label required');
      return;
    }
    if (!isAddress(wlAddress)) {
      alert('Invalid EVM address');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wlAddress, label: wlLabel, chainId: wlChainId }),
      });
      setShowWhitelistAdd(false);
      setWlAddress('');
      setWlLabel('');
      setWlChainId(null);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add whitelist entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhitelistRemove = async (id: string) => {
    if (!confirm('Remove this address from whitelist?')) return;
    try {
      await apiFetch('/api/admin/whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  const handleTransferRequest = async () => {
    if (!trFromWallet.trim() || !trToAddress.trim() || !trToken.trim() || !trAmount.trim()) {
      alert('All fields required');
      return;
    }
    if (!isAddress(trToAddress)) {
      alert('Invalid toAddress');
      return;
    }
    // Step 1 confirmation
    if (trConfirmAddress !== trToAddress || trConfirmAmount !== trAmount) {
      alert('Please re-type address and amount to confirm');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/admin/treasury/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: trChainId,
          fromWallet: trFromWallet,
          toAddress: trToAddress,
          token: trToken,
          amount: trAmount,
          note: trNote,
        }),
      });
      setShowTransferRequest(false);
      setTrFromWallet('');
      setTrToAddress('');
      setTrToken('');
      setTrAmount('');
      setTrNote('');
      setTrConfirmAddress('');
      setTrConfirmAmount('');
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Transfer request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this transfer?')) return;
    try {
      await apiFetch(`/api/admin/treasury/transfers/${id}/approve`, { method: 'POST' });
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approval failed');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await apiFetch(`/api/admin/treasury/transfers/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Rejection failed');
    }
  };

  const handleExecute = async () => {
    if (!execTxHash.trim()) {
      alert('TX hash required');
      return;
    }
    if (!showExecute) return;

    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/treasury/transfers/${showExecute.id}/executed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: execTxHash }),
      });
      setShowExecute(null);
      setExecTxHash('');
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Execute failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadData} />;

  const tokens = tokensFor(trChainId);

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Treasury</h1>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowWhitelistAdd(true)}
          className="px-4 py-2 rounded-lg font-bold text-sm"
          style={{ background: '#00c9a7', color: '#050806' }}
        >
          + Add Whitelist Address
        </button>
        <button
          onClick={() => setShowTransferRequest(true)}
          className="px-4 py-2 rounded-lg font-bold text-sm"
          style={{ background: '#FFB020', color: '#050806' }}
        >
          Request Transfer
        </button>
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Whitelist ({whitelist.length})</h2>
      <div className="mb-8">
        <DataTable
          columns={[
            { key: 'address', label: 'Address', render: w => <span className="font-mono text-sm">{w.address}</span> },
            { key: 'label', label: 'Label', render: w => w.label },
            { key: 'chain', label: 'Chain', render: w => w.chain_id ? CHAIN_META[w.chain_id]?.name || `Chain ${w.chain_id}` : 'All chains' },
            { key: 'created', label: 'Added', render: w => formatDate(w.created_at) },
            {
              key: 'actions',
              label: '',
              render: w => (
                <button
                  onClick={() => handleWhitelistRemove(w.id)}
                  className="text-xs underline"
                  style={{ color: '#FF4D5E' }}
                >
                  Remove
                </button>
              ),
            },
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
          { key: 'chain', label: 'Chain', render: t => CHAIN_META[t.chain_id]?.short || t.chain_id },
          { key: 'to', label: 'To', render: t => <span className="font-mono text-xs">{t.to_address.slice(0, 10)}...</span> },
          { key: 'amount', label: 'Amount', render: t => `${t.amount} ${t.token}`, mono: true },
          { key: 'status', label: 'Status', render: t => <StatusChip status={t.status} /> },
          { key: 'created', label: 'Created', render: t => formatDate(t.created_at) },
          {
            key: 'actions',
            label: 'Actions',
            render: t => {
              if (t.status === 'REQUESTED') {
                return (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(t.id)}
                      className="px-2 py-1 rounded text-xs font-bold"
                      style={{ background: '#00c9a740', color: '#00c9a7' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(t.id)}
                      className="px-2 py-1 rounded text-xs font-bold"
                      style={{ background: '#FF4D5E40', color: '#FF4D5E' }}
                    >
                      Reject
                    </button>
                  </div>
                );
              }
              if (t.status === 'APPROVED') {
                return (
                  <button
                    onClick={() => setShowExecute(t)}
                    className="px-3 py-1 rounded text-xs font-bold"
                    style={{ background: '#FFB020', color: '#050806' }}
                  >
                    Execute
                  </button>
                );
              }
              return '—';
            },
          },
        ]}
        data={transfers}
        keyExtractor={t => t.id}
        emptyText="No transfers"
      />

      {/* Whitelist add drawer */}
      <Drawer isOpen={showWhitelistAdd} onClose={() => setShowWhitelistAdd(false)} title="Add Whitelist Address">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Address (EVM)</label>
            <input
              type="text"
              placeholder="0x..."
              value={wlAddress}
              onChange={e => setWlAddress(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Label</label>
            <input
              type="text"
              value={wlLabel}
              onChange={e => setWlLabel(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Chain (optional, leave blank for all)</label>
            <select
              value={wlChainId || ''}
              onChange={e => setWlChainId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            >
              <option value="">All chains</option>
              {SUPPORTED_CHAINS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleWhitelistAdd}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg font-bold"
            style={{ background: '#00c9a7', color: '#fff', opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? 'Adding...' : 'Add to Whitelist'}
          </button>
        </div>
      </Drawer>

      {/* Transfer request drawer */}
      <Drawer isOpen={showTransferRequest} onClose={() => setShowTransferRequest(false)} title="Request Transfer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Chain</label>
            <select
              value={trChainId}
              onChange={e => setTrChainId(parseInt(e.target.value))}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            >
              {SUPPORTED_CHAINS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>From Wallet (label/address)</label>
            <input
              type="text"
              value={trFromWallet}
              onChange={e => setTrFromWallet(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>To Address (must be whitelisted)</label>
            <input
              type="text"
              placeholder="0x..."
              value={trToAddress}
              onChange={e => setTrToAddress(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Token</label>
            <select
              value={trToken}
              onChange={e => setTrToken(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            >
              <option value="">Select token...</option>
              {tokens.map(t => (
                <option key={t.symbol} value={t.symbol}>{t.symbol} - {t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Amount</label>
            <input
              type="text"
              value={trAmount}
              onChange={e => setTrAmount(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Note (optional)</label>
            <textarea
              value={trNote}
              onChange={e => setTrNote(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>

          <div className="pt-4 border-t" style={{ borderColor: '#1f1f1f' }}>
            <p className="text-sm font-bold mb-3" style={{ color: '#FFB020' }}>Confirm transfer details:</p>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Re-type To Address:</label>
              <input
                type="text"
                value={trConfirmAddress}
                onChange={e => setTrConfirmAddress(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
            <div className="mt-2">
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Re-type Amount:</label>
              <input
                type="text"
                value={trConfirmAmount}
                onChange={e => setTrConfirmAmount(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
          </div>

          <button
            onClick={handleTransferRequest}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg font-bold"
            style={{ background: '#FFB020', color: '#050806', opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? 'Requesting...' : 'Request Transfer'}
          </button>
        </div>
      </Drawer>

      {/* Execute drawer */}
      {showExecute && (
        <Drawer isOpen={true} onClose={() => setShowExecute(null)} title="Execute Transfer">
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <p className="text-xs mb-2" style={{ color: '#8FA398' }}>Transfer Details:</p>
              <p className="text-sm mb-1" style={{ color: '#fff' }}>Chain: {CHAIN_META[showExecute.chain_id]?.name}</p>
              <p className="text-sm mb-1 font-mono" style={{ color: '#fff' }}>To: {showExecute.to_address}</p>
              <p className="text-sm font-mono font-bold" style={{ color: '#00c9a7' }}>{showExecute.amount} {showExecute.token}</p>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>TX Hash (after executing on-chain)</label>
              <input
                type="text"
                placeholder="0x..."
                value={execTxHash}
                onChange={e => setExecTxHash(e.target.value)}
                className="w-full px-4 py-2 rounded-lg text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
            <button
              onClick={handleExecute}
              disabled={submitting}
              className="w-full px-4 py-3 rounded-lg font-bold"
              style={{ background: '#00c9a7', color: '#fff', opacity: submitting ? 0.5 : 1 }}
            >
              {submitting ? 'Recording...' : 'Record Execution'}
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
