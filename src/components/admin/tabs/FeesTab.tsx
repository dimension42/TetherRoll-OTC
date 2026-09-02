'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, formatDate, Drawer } from '../ui';
import { useContractAdmin } from '../hooks/useContractAdmin';
import { SUPPORTED_CHAINS, CHAIN_META } from '@/lib/chains';
import { useAccount, useConnect } from 'wagmi';

interface FeeConfig {
  id: string;
  key: string;
  value: number;
  venue_id: string | null;
  changed_by: string | null;
  changed_at: string;
}

const FEE_KEYS = [
  { key: 'spread_bps', label: 'Spread (bps)', min: 0, max: 500 },
  { key: 'gas_margin_pct', label: 'Gas Margin (%)', min: 0, max: 100 },
  { key: 'partial_discount_pct', label: 'Partial Fill Discount (%)', min: 0, max: 100 },
  { key: 'swap_fee_bps', label: 'Swap Fee (bps)', min: 0, max: 100 },
  { key: 'penalty_bps', label: 'Penalty (bps)', min: 0, max: 5000 },
  { key: 'roll_max_amount_krw', label: 'Roll Max Amount KRW', min: 0, max: 999999999999 },
  { key: 'roll_min_fill_pct_floor', label: 'Roll Min Fill % Floor', min: 0, max: 100 },
];

export default function FeesTab() {
  const [fees, setFees] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showOnChainPanel, setShowOnChainPanel] = useState(false);
  const [selectedChain, setSelectedChain] = useState<number>(11155111);

  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [newFeeBps, setNewFeeBps] = useState('');
  const [newPenaltyBps, setNewPenaltyBps] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const contract = useContractAdmin(selectedChain);

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

  const handleUpdate = async () => {
    if (!formKey || formValue === '') {
      alert('Key and value required');
      return;
    }
    const keyDef = FEE_KEYS.find(k => k.key === formKey);
    const val = parseFloat(formValue);
    if (isNaN(val) || (keyDef && (val < keyDef.min || val > keyDef.max))) {
      alert(`Value must be between ${keyDef?.min} and ${keyDef?.max}`);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: formKey, value: val }),
      });
      setShowUpdateForm(false);
      setFormKey('');
      setFormValue('');
      await loadFees();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOnChainSetFees = async () => {
    const fee = parseInt(newFeeBps);
    const penalty = parseInt(newPenaltyBps);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      alert('Fee must be 0-100 bps');
      return;
    }
    if (isNaN(penalty) || penalty < 0 || penalty > 5000) {
      alert('Penalty must be 0-5000 bps');
      return;
    }

    try {
      contract.setFees(fee, penalty);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Transaction failed');
    }
  };

  useEffect(() => {
    if (contract.isConfirmed && contract.txHash) {
      apiFetch('/api/admin/contract/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: selectedChain,
          action: 'setFees',
          txHash: contract.txHash,
          after: { feeBps: parseInt(newFeeBps), penaltyBps: parseInt(newPenaltyBps) },
        }),
      }).catch(console.error);
    }
  }, [contract.isConfirmed, contract.txHash, selectedChain, newFeeBps, newPenaltyBps]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadFees} />;

  const latestByKey: Record<string, FeeConfig> = {};
  for (const f of fees) {
    if (!latestByKey[f.key] || new Date(f.changed_at) > new Date(latestByKey[f.key].changed_at)) {
      latestByKey[f.key] = f;
    }
  }
  const current = Object.values(latestByKey);

  // Filter chains with non-zero addresses

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Fee Configuration</h1>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowUpdateForm(true)}
          className="px-4 py-2 rounded-lg font-bold text-sm"
          style={{ background: '#00c9a7', color: '#050806' }}
        >
          Update Fee Config
        </button>
        <button
          onClick={() => setShowOnChainPanel(true)}
          className="px-4 py-2 rounded-lg font-bold text-sm"
          style={{ background: '#FFB020', color: '#050806' }}
        >
          On-Chain Fee Management
        </button>
      </div>

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

      <Drawer isOpen={showUpdateForm} onClose={() => setShowUpdateForm(false)} title="Update Fee Config">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Fee Key</label>
            <select
              value={formKey}
              onChange={e => setFormKey(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            >
              <option value="">Select key...</option>
              {FEE_KEYS.map(k => (
                <option key={k.key} value={k.key}>{k.label} ({k.min}-{k.max})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Value</label>
            <input
              type="number"
              value={formValue}
              onChange={e => setFormValue(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <button
            onClick={handleUpdate}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg font-bold"
            style={{ background: '#00c9a7', color: '#fff', opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? 'Updating...' : 'Update Config'}
          </button>
        </div>
      </Drawer>

      <Drawer isOpen={showOnChainPanel} onClose={() => setShowOnChainPanel(false)} title="On-Chain Fee Management" width="700px">
        <div className="space-y-4">
          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-sm mb-4" style={{ color: '#8FA398' }}>Connect wallet to manage on-chain fees</p>
              <button
                onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                className="px-6 py-3 rounded-lg font-bold"
                style={{ background: '#00c9a7', color: '#fff' }}
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Chain</label>
                <select
                  value={selectedChain}
                  onChange={e => setSelectedChain(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg text-sm"
                  style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                >
                  {SUPPORTED_CHAINS.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Current On-Chain State</h3>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Contract: <span className="font-mono text-white">{contract.contractAddress}</span></p>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Fee Recipient: <span className="font-mono text-white">{contract.feeRecipient || '—'}</span></p>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Swap Fee: <span className="font-mono text-white">{contract.feeBps !== undefined ? `${contract.feeBps} bps` : '—'}</span></p>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Penalty: <span className="font-mono text-white">{contract.penaltyBps !== undefined ? `${contract.penaltyBps} bps` : '—'}</span></p>
                <p className="text-xs" style={{ color: '#8FA398' }}>Paused: <span className="font-mono text-white">{contract.paused ? 'Yes' : 'No'}</span></p>
              </div>

              <div className="p-3 rounded" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Connected Wallet:</p>
                <p className="text-xs font-mono mb-2" style={{ color: '#fff' }}>{address}</p>
                {!contract.isDefaultAdmin ? (
                  <p className="text-xs font-bold" style={{ color: '#FF4D5E' }}>
                    ⚠️ Wallet {address?.slice(0, 10)}... is not contract admin on {CHAIN_META[selectedChain]?.name}
                  </p>
                ) : (
                  <p className="text-xs font-bold" style={{ color: '#00c9a7' }}>
                    ✓ Has DEFAULT_ADMIN_ROLE
                  </p>
                )}
              </div>

              {contract.isDefaultAdmin && (
                <>
                  <div>
                    <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>New Fee (bps, 0-100)</label>
                    <input
                      type="number"
                      value={newFeeBps}
                      onChange={e => setNewFeeBps(e.target.value)}
                      placeholder={contract.feeBps?.toString() || '30'}
                      className="w-full px-4 py-2 rounded-lg text-sm font-mono"
                      style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>New Penalty (bps, 0-5000)</label>
                    <input
                      type="number"
                      value={newPenaltyBps}
                      onChange={e => setNewPenaltyBps(e.target.value)}
                      placeholder={contract.penaltyBps?.toString() || '1000'}
                      className="w-full px-4 py-2 rounded-lg text-sm font-mono"
                      style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                    />
                  </div>
                  <button
                    onClick={handleOnChainSetFees}
                    disabled={contract.isPending || contract.isConfirming}
                    className="w-full px-4 py-3 rounded-lg font-bold"
                    style={{ background: '#00c9a7', color: '#fff', opacity: contract.isPending || contract.isConfirming ? 0.5 : 1 }}
                  >
                    {contract.isPending ? 'Confirm in Wallet...' : contract.isConfirming ? 'Confirming...' : 'Update Fees On-Chain'}
                  </button>
                </>
              )}

              {contract.writeError && (
                <div className="p-3 rounded" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid #FF4D5E40' }}>
                  <p className="text-xs" style={{ color: '#FF4D5E' }}>
                    Error: {contract.writeError.message}
                  </p>
                </div>
              )}

              {contract.txHash && (
                <div className="p-3 rounded" style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid #00c9a740' }}>
                  <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Transaction:</p>
                  <a
                    href={contract.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono underline break-all"
                    style={{ color: '#00c9a7' }}
                  >
                    {contract.txHash}
                  </a>
                  <p className="text-xs mt-2" style={{ color: contract.isConfirmed ? '#00c9a7' : '#FFB020' }}>
                    {contract.isConfirmed ? '✓ Confirmed' : '⏳ Confirming...'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
