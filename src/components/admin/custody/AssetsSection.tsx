'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, Drawer, ConfirmDialog, StatusChip } from '../ui';

interface Asset {
  id: string;
  chain_key: string;
  chain_name: string;
  symbol: string;
  name: string;
  decimals: number;
  kind: string;
  token_id: string | null;
  deposit_address: string;
  address_regex: string | null;
  explorer_tx_url: string | null;
  explorer_address_url: string | null;
  verifier: string;
  verifier_config: Record<string, unknown>;
  min_confirmations: number;
  min_amount: string;
  max_amount: string | null;
  payout_2p_threshold: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface Preset {
  label: string;
  data: Partial<FormData>;
}

interface FormData {
  chainKey: string;
  chainName: string;
  symbol: string;
  name: string;
  decimals: number;
  kind: 'native' | 'token';
  tokenId: string;
  depositAddress: string;
  addressRegex: string;
  explorerTxUrl: string;
  explorerAddressUrl: string;
  verifier: 'bitcoin' | 'tron' | 'solana' | 'evm' | 'manual';
  verifierConfig: string;
  minConfirmations: number;
  minAmount: string;
  maxAmount: string;
  payout2pThreshold: string;
  enabled: boolean;
}

const PRESETS: Preset[] = [
  {
    label: 'BTC Mainnet',
    data: {
      chainKey: 'BTC',
      chainName: 'Bitcoin Mainnet',
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      kind: 'native',
      addressRegex: '^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$',
      explorerTxUrl: 'https://mempool.space/tx/{hash}',
      explorerAddressUrl: 'https://mempool.space/address/{address}',
      verifier: 'bitcoin',
      verifierConfig: '{"apiBase":"https://mempool.space/api"}',
      minConfirmations: 2,
      minAmount: '10000',
      enabled: false,
    },
  },
  {
    label: 'Tron USDT (TRC-20)',
    data: {
      chainKey: 'TRON',
      chainName: 'Tron Mainnet',
      symbol: 'USDT',
      name: 'Tether USD (TRC-20)',
      decimals: 6,
      kind: 'token',
      tokenId: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      addressRegex: '^T[1-9A-HJ-NP-Za-km-z]{33}$',
      explorerTxUrl: 'https://tronscan.org/#/transaction/{hash}',
      explorerAddressUrl: 'https://tronscan.org/#/address/{address}',
      verifier: 'tron',
      verifierConfig: '{}',
      minConfirmations: 1,
      minAmount: '1000000',
      enabled: false,
    },
  },
  {
    label: 'Tron TRX',
    data: {
      chainKey: 'TRON',
      chainName: 'Tron Mainnet',
      symbol: 'TRX',
      name: 'Tronix',
      decimals: 6,
      kind: 'native',
      addressRegex: '^T[1-9A-HJ-NP-Za-km-z]{33}$',
      explorerTxUrl: 'https://tronscan.org/#/transaction/{hash}',
      explorerAddressUrl: 'https://tronscan.org/#/address/{address}',
      verifier: 'tron',
      verifierConfig: '{}',
      minConfirmations: 1,
      minAmount: '1000000',
      enabled: false,
    },
  },
  {
    label: 'Solana SOL',
    data: {
      chainKey: 'SOLANA',
      chainName: 'Solana Mainnet',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      kind: 'native',
      addressRegex: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
      explorerTxUrl: 'https://solscan.io/tx/{hash}',
      explorerAddressUrl: 'https://solscan.io/account/{address}',
      verifier: 'solana',
      verifierConfig: '{}',
      minConfirmations: 1,
      minAmount: '1000000',
      enabled: false,
    },
  },
  {
    label: 'Solana USDC (SPL)',
    data: {
      chainKey: 'SOLANA',
      chainName: 'Solana Mainnet',
      symbol: 'USDC',
      name: 'USD Coin (SPL)',
      decimals: 6,
      kind: 'token',
      tokenId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      addressRegex: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
      explorerTxUrl: 'https://solscan.io/tx/{hash}',
      explorerAddressUrl: 'https://solscan.io/account/{address}',
      verifier: 'solana',
      verifierConfig: '{}',
      minConfirmations: 1,
      minAmount: '1000000',
      enabled: false,
    },
  },
  {
    label: 'Litecoin (Manual)',
    data: {
      chainKey: 'LTC',
      chainName: 'Litecoin',
      symbol: 'LTC',
      name: 'Litecoin',
      decimals: 8,
      kind: 'native',
      addressRegex: '^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$',
      explorerTxUrl: 'https://blockchair.com/litecoin/transaction/{hash}',
      explorerAddressUrl: 'https://blockchair.com/litecoin/address/{address}',
      verifier: 'manual',
      verifierConfig: '{}',
      minConfirmations: 2,
      minAmount: '100000',
      enabled: false,
    },
  },
  {
    label: 'Custom',
    data: {
      chainKey: '',
      chainName: '',
      symbol: '',
      name: '',
      decimals: 8,
      kind: 'native',
      verifier: 'manual',
      verifierConfig: '{}',
      minConfirmations: 2,
      minAmount: '0',
      enabled: false,
    },
  },
];

export default function AssetsSection() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Asset | null>(null);

  const [form, setForm] = useState<FormData>({
    chainKey: '',
    chainName: '',
    symbol: '',
    name: '',
    decimals: 8,
    kind: 'native',
    tokenId: '',
    depositAddress: '',
    addressRegex: '',
    explorerTxUrl: '',
    explorerAddressUrl: '',
    verifier: 'manual',
    verifierConfig: '{}',
    minConfirmations: 2,
    minAmount: '0',
    maxAmount: '',
    payout2pThreshold: '',
    enabled: false,
  });

  const loadAssets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ assets: Asset[] }>('/api/admin/custody/assets');
      setAssets(data.assets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handlePreset = (preset: Preset) => {
    setForm({ ...form, ...preset.data });
    setShowDrawer(true);
    setEditingAsset(null);
  };

  const handleEdit = (asset: Asset) => {
    setForm({
      chainKey: asset.chain_key,
      chainName: asset.chain_name,
      symbol: asset.symbol,
      name: asset.name,
      decimals: asset.decimals,
      kind: asset.kind as 'native' | 'token',
      tokenId: asset.token_id || '',
      depositAddress: asset.deposit_address,
      addressRegex: asset.address_regex || '',
      explorerTxUrl: asset.explorer_tx_url || '',
      explorerAddressUrl: asset.explorer_address_url || '',
      verifier: asset.verifier as 'bitcoin' | 'tron' | 'solana' | 'evm' | 'manual',
      verifierConfig: JSON.stringify(asset.verifier_config),
      minConfirmations: asset.min_confirmations,
      minAmount: asset.min_amount,
      maxAmount: asset.max_amount || '',
      payout2pThreshold: asset.payout_2p_threshold || '',
      enabled: asset.enabled,
    });
    setEditingAsset(asset);
    setShowDrawer(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        chainKey: form.chainKey,
        chainName: form.chainName,
        symbol: form.symbol,
        name: form.name,
        decimals: form.decimals,
        kind: form.kind,
        tokenId: form.tokenId || undefined,
        depositAddress: form.depositAddress,
        addressRegex: form.addressRegex || undefined,
        explorerTxUrl: form.explorerTxUrl || undefined,
        explorerAddressUrl: form.explorerAddressUrl || undefined,
        verifier: form.verifier,
        verifierConfig: JSON.parse(form.verifierConfig),
        minConfirmations: form.minConfirmations,
        minAmount: form.minAmount,
        maxAmount: form.maxAmount || undefined,
        payout2pThreshold: form.payout2pThreshold || undefined,
        enabled: form.enabled,
      };

      if (editingAsset) {
        await apiFetch(`/api/admin/custody/assets/${editingAsset.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/custody/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setShowDrawer(false);
      setEditingAsset(null);
      await loadAssets();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await apiFetch(`/api/admin/custody/assets/${deleteConfirm.id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      await loadAssets();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleToggleEnabled = async (asset: Asset) => {
    try {
      await apiFetch(`/api/admin/custody/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !asset.enabled }),
      });
      await loadAssets();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Toggle failed');
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadAssets} />;

  const recentlyChanged = assets.filter(a => {
    const diff = Date.now() - new Date(a.updated_at).getTime();
    return diff < 24 * 60 * 60 * 1000; // 24 hours
  });

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-6">
        {PRESETS.map((preset, i) => (
          <button
            key={i}
            onClick={() => handlePreset(preset)}
            className="px-3 py-2 rounded-lg text-sm font-bold"
            style={{
              background: preset.label === 'Custom' ? '#FFB020' : '#00c9a740',
              color: preset.label === 'Custom' ? '#050806' : '#00c9a7',
              border: `1px solid ${preset.label === 'Custom' ? '#FFB020' : '#00c9a760'}`,
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {recentlyChanged.length > 0 && (
        <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(255,176,32,0.1)', border: '1px solid rgba(255,176,32,0.3)' }}>
          <p className="text-sm font-bold mb-2" style={{ color: '#FFB020' }}>⚠️ Recently Changed Addresses (24h):</p>
          {recentlyChanged.map(a => (
            <p key={a.id} className="text-xs font-mono" style={{ color: '#C8D5D0' }}>
              {a.symbol} ({a.chain_key}): {a.deposit_address}
            </p>
          ))}
        </div>
      )}

      <DataTable
        columns={[
          { key: 'symbol', label: 'Symbol', render: a => <span className="font-bold">{a.symbol}</span> },
          { key: 'chain', label: 'Chain', render: a => `${a.chain_name} (${a.chain_key})` },
          { key: 'kind', label: 'Kind', render: a => a.kind.toUpperCase() },
          { key: 'verifier', label: 'Verifier', render: a => a.verifier },
          { key: 'deposit', label: 'Deposit Address', render: a => <span className="font-mono text-xs">{a.deposit_address.slice(0, 20)}...</span>, mono: true },
          { key: 'enabled', label: 'Status', render: a => a.enabled ? <StatusChip status="OPEN" label="Enabled" /> : <StatusChip status="HIDDEN" label="Disabled" /> },
          {
            key: 'actions',
            label: 'Actions',
            render: a => (
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(a)}
                  className="px-2 py-1 rounded text-xs font-bold"
                  style={{ background: '#00c9a740', color: '#00c9a7' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleEnabled(a)}
                  className="px-2 py-1 rounded text-xs font-bold"
                  style={{ background: a.enabled ? '#8FA39820' : '#00c9a740', color: a.enabled ? '#8FA398' : '#00c9a7' }}
                >
                  {a.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(a)}
                  className="px-2 py-1 rounded text-xs font-bold"
                  style={{ background: '#FF4D5E40', color: '#FF4D5E' }}
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]}
        data={assets}
        keyExtractor={a => a.id}
        emptyText="No assets configured. Click a preset to add one."
      />

      {/* Drawer */}
      <Drawer isOpen={showDrawer} onClose={() => setShowDrawer(false)} title={editingAsset ? 'Edit Asset' : 'Add Asset'} width="700px">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Chain Key (2-16 uppercase)</label>
              <input
                type="text"
                value={form.chainKey}
                onChange={e => setForm({ ...form, chainKey: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Chain Name</label>
              <input
                type="text"
                value={form.chainName}
                onChange={e => setForm({ ...form, chainName: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Symbol</label>
              <input
                type="text"
                value={form.symbol}
                onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Decimals</label>
              <input
                type="number"
                value={form.decimals}
                onChange={e => setForm({ ...form, decimals: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                min={0}
                max={18}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Kind</label>
              <select
                value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value as 'native' | 'token' })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              >
                <option value="native">Native</option>
                <option value="token">Token</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Min Confirmations</label>
              <input
                type="number"
                value={form.minConfirmations}
                onChange={e => setForm({ ...form, minConfirmations: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                min={0}
                max={100}
              />
            </div>
          </div>

          {form.kind === 'token' && (
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Token ID (contract/mint address)</label>
              <input
                type="text"
                value={form.tokenId}
                onChange={e => setForm({ ...form, tokenId: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Deposit Address (Platform Wallet)</label>
            <input
              type="text"
              value={form.depositAddress}
              onChange={e => setForm({ ...form, depositAddress: e.target.value })}
              className="w-full px-3 py-2 rounded text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Address Regex (optional, for user address validation)</label>
            <input
              type="text"
              value={form.addressRegex}
              onChange={e => setForm({ ...form, addressRegex: e.target.value })}
              className="w-full px-3 py-2 rounded text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Explorer TX URL (use {'{hash}'})</label>
              <input
                type="text"
                value={form.explorerTxUrl}
                onChange={e => setForm({ ...form, explorerTxUrl: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Explorer Address URL (optional)</label>
              <input
                type="text"
                value={form.explorerAddressUrl}
                onChange={e => setForm({ ...form, explorerAddressUrl: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Verifier</label>
              <select
                value={form.verifier}
                onChange={e => setForm({ ...form, verifier: e.target.value as 'bitcoin' | 'tron' | 'solana' | 'evm' | 'manual' })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              >
                <option value="bitcoin">Bitcoin</option>
                <option value="tron">Tron</option>
                <option value="solana">Solana</option>
                <option value="evm">EVM</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Verifier Config (JSON)</label>
              <input
                type="text"
                value={form.verifierConfig}
                onChange={e => setForm({ ...form, verifierConfig: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                placeholder='{"apiBase":"..."}'
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Min Amount (minor units)</label>
              <input
                type="text"
                value={form.minAmount}
                onChange={e => setForm({ ...form, minAmount: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Max Amount (optional)</label>
              <input
                type="text"
                value={form.maxAmount}
                onChange={e => setForm({ ...form, maxAmount: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>2P Threshold (optional)</label>
              <input
                type="text"
                value={form.payout2pThreshold}
                onChange={e => setForm({ ...form, payout2pThreshold: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm font-mono"
                style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
            />
            <label htmlFor="enabled" className="text-sm" style={{ color: '#C8D5D0' }}>
              Enabled (visible to users)
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg font-bold"
            style={{ background: '#00c9a7', color: '#fff', opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? 'Saving...' : editingAsset ? 'Update Asset' : 'Create Asset'}
          </button>
        </div>
      </Drawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Asset"
        message={`Are you sure you want to delete ${deleteConfirm?.symbol}? This will fail if any legs reference it.`}
        confirmText="Delete"
        confirmColor="#FF4D5E"
      />
    </div>
  );
}
