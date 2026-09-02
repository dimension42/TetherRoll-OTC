'use client';

import { useState, useEffect } from 'react';
import { apiFetch, Loading, ErrorMessage, StatusChip, ConfirmDialog, Drawer } from '../ui';
import { useContractAdmin } from '../hooks/useContractAdmin';
import { SUPPORTED_CHAINS, CHAIN_META } from '@/lib/chains';
import { useAccount, useConnect } from 'wagmi';
import { isAddress } from 'viem';

interface Settings {
  killSwitch: { enabled: boolean; reason: string | null };
  announcements: { id: string; text: string; level: string; active: boolean; expires_at: string | null; created_at: string }[];
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showKillSwitchDialog, setShowKillSwitchDialog] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  const [annText, setAnnText] = useState('');
  const [annLevel, setAnnLevel] = useState<'info' | 'warn' | 'danger'>('info');
  const [annExpiresAt, setAnnExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [selectedChain, setSelectedChain] = useState<number>(11155111);
  const contract = useContractAdmin(selectedChain);

  const [newFeeRecipient, setNewFeeRecipient] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ settings: Settings }>('/api/admin/settings');
      setSettings(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const toggleKillSwitch = async () => {
    if (!settings) return;
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'kill_switch',
          value: {
            enabled: !settings.killSwitch.enabled,
            reason: !settings.killSwitch.enabled ? 'Admin toggled' : null,
          },
        }),
      });
      setShowKillSwitchDialog(false);
      await loadSettings();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to toggle kill switch');
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!annText.trim()) {
      alert('Text required');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: annText, level: annLevel, expiresAt: annExpiresAt || null }),
      });
      setShowAnnouncementForm(false);
      setAnnText('');
      setAnnLevel('info');
      setAnnExpiresAt('');
      await loadSettings();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAnnouncement = async (id: string, currentActive: boolean) => {
    try {
      await apiFetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      });
      await loadSettings();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to toggle announcement');
    }
  };

  const handleSetFeeRecipient = async () => {
    if (!newFeeRecipient.trim()) {
      alert('Address required');
      return;
    }
    // Check for Tron address pattern
    if (/^T[A-Za-z0-9]{33}$/.test(newFeeRecipient)) {
      alert('EVM 주소만 가능 (Tron 주소는 지원하지 않습니다)');
      return;
    }
    if (!isAddress(newFeeRecipient)) {
      alert('Invalid EVM address');
      return;
    }

    try {
      contract.setFeeRecipient(newFeeRecipient as `0x${string}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Transaction failed');
    }
  };

  const handlePause = () => {
    try {
      contract.pause();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Transaction failed');
    }
  };

  const handleUnpause = () => {
    try {
      contract.unpause();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Transaction failed');
    }
  };

  useEffect(() => {
    if (contract.isConfirmed && contract.txHash) {
      const action = newFeeRecipient ? 'setFeeRecipient' : contract.paused ? 'pause' : 'unpause';
      apiFetch('/api/admin/contract/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: selectedChain,
          action,
          txHash: contract.txHash,
          after: action === 'setFeeRecipient' ? { feeRecipient: newFeeRecipient } : { paused: contract.paused },
        }),
      }).catch(console.error);
    }
  }, [contract.isConfirmed, contract.txHash, selectedChain, newFeeRecipient, contract.paused]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadSettings} />;
  if (!settings) return null;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Platform Settings</h1>

      <div className="p-6 rounded-xl mb-8" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Kill Switch</h2>
            <p className="text-sm" style={{ color: '#8FA398' }}>
              Temporarily disable new pool/trade/Roll Order creation (emergency brake)
            </p>
          </div>
          <button
            onClick={() => setShowKillSwitchDialog(true)}
            className="px-6 py-3 rounded-lg font-bold"
            style={{
              background: settings.killSwitch.enabled ? '#00c9a7' : '#FF4D5E',
              color: '#fff',
            }}
          >
            {settings.killSwitch.enabled ? 'Enable Trading' : 'DISABLE TRADING'}
          </button>
        </div>
        {settings.killSwitch.enabled && (
          <div className="p-3 rounded" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid #FF4D5E40' }}>
            <p className="text-sm font-bold" style={{ color: '#FF4D5E' }}>
              🚨 Kill switch is ACTIVE: {settings.killSwitch.reason || 'No reason provided'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Announcements ({settings.announcements.length})</h2>
        <button
          onClick={() => setShowAnnouncementForm(true)}
          className="px-4 py-2 rounded-lg font-bold text-sm"
          style={{ background: '#00c9a7', color: '#050806' }}
        >
          + Create Announcement
        </button>
      </div>
      <div className="space-y-3 mb-8">
        {settings.announcements.map(a => (
          <div
            key={a.id}
            className="p-4 rounded-lg"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <StatusChip status={a.level.toUpperCase()} label={a.level} />
                  <StatusChip status={a.active ? 'ACTIVE' : 'INACTIVE'} />
                </div>
                <p className="text-sm" style={{ color: '#C8D5D0' }}>{a.text}</p>
                <p className="text-xs mt-2" style={{ color: '#8FA398' }}>
                  Expires: {a.expires_at || 'Never'}
                </p>
              </div>
              <button
                onClick={() => handleToggleAnnouncement(a.id, a.active)}
                className="px-3 py-1 rounded text-xs font-bold ml-4"
                style={{ background: a.active ? '#FF4D5E40' : '#00c9a740', color: a.active ? '#FF4D5E' : '#00c9a7' }}
              >
                {a.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Contract Administration</h2>
      {!isConnected ? (
        <div className="p-6 rounded-xl text-center" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-sm mb-4" style={{ color: '#8FA398' }}>Connect wallet to manage on-chain contracts</p>
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
          <div className="mb-4">
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Select Chain</label>
            <select
              value={selectedChain}
              onChange={e => setSelectedChain(parseInt(e.target.value))}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            >
              {SUPPORTED_CHAINS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="p-6 rounded-xl mb-4" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            <h3 className="text-lg font-bold text-white mb-4">{CHAIN_META[selectedChain]?.name} Contract</h3>
            <div className="space-y-2 mb-4">
              <p className="text-xs" style={{ color: '#8FA398' }}>Contract: <span className="font-mono text-white">{contract.contractAddress}</span></p>
              <p className="text-xs" style={{ color: '#8FA398' }}>Fee Recipient: <span className="font-mono text-white">{contract.feeRecipient || '—'}</span></p>
              <p className="text-xs" style={{ color: '#8FA398' }}>Fee: <span className="font-mono text-white">{contract.feeBps !== undefined ? `${contract.feeBps} bps` : '—'}</span></p>
              <p className="text-xs" style={{ color: '#8FA398' }}>Penalty: <span className="font-mono text-white">{contract.penaltyBps !== undefined ? `${contract.penaltyBps} bps` : '—'}</span></p>
              <p className="text-xs" style={{ color: '#8FA398' }}>Paused: <span className="font-mono text-white">{contract.paused ? 'Yes' : 'No'}</span></p>
            </div>

            <div className="p-3 rounded mb-4" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
              <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Connected: <span className="font-mono text-white">{address?.slice(0, 10)}...</span></p>
              <p className="text-xs" style={{ color: '#8FA398' }}>
                DEFAULT_ADMIN_ROLE: <span style={{ color: contract.isDefaultAdmin ? '#00c9a7' : '#FF4D5E' }}>{contract.isDefaultAdmin ? 'Yes' : 'No'}</span>
              </p>
              <p className="text-xs" style={{ color: '#8FA398' }}>
                PAUSER_ROLE: <span style={{ color: contract.isPauser ? '#00c9a7' : '#FF4D5E' }}>{contract.isPauser ? 'Yes' : 'No'}</span>
              </p>
            </div>

            {contract.isDefaultAdmin && (
              <div className="mb-4">
                <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Set Fee Recipient</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newFeeRecipient}
                    onChange={e => setNewFeeRecipient(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-mono"
                    style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                  />
                  <button
                    onClick={handleSetFeeRecipient}
                    disabled={contract.isPending || contract.isConfirming}
                    className="px-4 py-2 rounded-lg font-bold text-sm"
                    style={{ background: '#00c9a7', color: '#fff', opacity: contract.isPending || contract.isConfirming ? 0.5 : 1 }}
                  >
                    Update
                  </button>
                </div>
              </div>
            )}

            {contract.isPauser && (
              <div className="flex gap-2">
                <button
                  onClick={handlePause}
                  disabled={contract.paused || contract.isPending || contract.isConfirming}
                  className="flex-1 px-4 py-2 rounded-lg font-bold text-sm"
                  style={{ background: '#FF4D5E', color: '#fff', opacity: contract.paused || contract.isPending || contract.isConfirming ? 0.5 : 1 }}
                >
                  Pause Contract
                </button>
                <button
                  onClick={handleUnpause}
                  disabled={!contract.paused || contract.isPending || contract.isConfirming}
                  className="flex-1 px-4 py-2 rounded-lg font-bold text-sm"
                  style={{ background: '#00c9a7', color: '#fff', opacity: !contract.paused || contract.isPending || contract.isConfirming ? 0.5 : 1 }}
                >
                  Unpause Contract
                </button>
              </div>
            )}

            {contract.txHash && (
              <div className="mt-4 p-3 rounded" style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid #00c9a740' }}>
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
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={showKillSwitchDialog}
        onClose={() => setShowKillSwitchDialog(false)}
        onConfirm={toggleKillSwitch}
        title={settings.killSwitch.enabled ? 'Enable Trading' : 'Disable Trading'}
        message={
          settings.killSwitch.enabled
            ? 'Are you sure you want to re-enable all trading operations?'
            : '⚠️ This will immediately disable all new pool creation, trades, and Roll Order submissions. Existing operations will continue to settle.'
        }
        confirmText={settings.killSwitch.enabled ? 'Enable' : 'Disable All Trading'}
        confirmColor={settings.killSwitch.enabled ? '#00c9a7' : '#FF4D5E'}
        requireTypedConfirm={settings.killSwitch.enabled ? undefined : 'DISABLE'}
      />

      <Drawer isOpen={showAnnouncementForm} onClose={() => setShowAnnouncementForm(false)} title="Create Announcement">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Text</label>
            <textarea
              value={annText}
              onChange={e => setAnnText(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Level</label>
            <select
              value={annLevel}
              onChange={e => setAnnLevel(e.target.value as 'info' | 'warn' | 'danger')}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            >
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Expires At (optional)</label>
            <input
              type="datetime-local"
              value={annExpiresAt}
              onChange={e => setAnnExpiresAt(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>
          <button
            onClick={handleCreateAnnouncement}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg font-bold"
            style={{ background: '#00c9a7', color: '#fff', opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? 'Creating...' : 'Create Announcement'}
          </button>
        </div>
      </Drawer>
    </div>
  );
}
