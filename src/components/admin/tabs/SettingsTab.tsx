'use client';

import { useState, useEffect } from 'react';
import { apiFetch, Loading, ErrorMessage, StatusChip, ConfirmDialog } from '../ui';

interface Settings {
  killSwitch: { enabled: boolean; reason: string | null };
  announcements: { id: string; text: string; level: string; active: boolean; expires_at: string | null; created_at: string }[];
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showKillSwitchDialog, setShowKillSwitchDialog] = useState(false);

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

      <h2 className="text-lg font-bold text-white mb-4">Announcements ({settings.announcements.length})</h2>
      <div className="space-y-3">
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
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm mt-4" style={{ color: '#8FA398' }}>
        Announcement management form + on-chain fee recipient panel coming in next iteration.
      </p>

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
    </div>
  );
}
