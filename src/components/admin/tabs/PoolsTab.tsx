'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate } from '../ui';
import { useContractAdmin } from '../hooks/useContractAdmin';
import { useAccount } from 'wagmi';

interface Pool {
  id: string;
  status: string;
  visibility: string;
  trade_type: string;
  offer_symbol: string;
  request_symbol: string;
  offer_amount: string;
  created_at: string;
  creator_id: string;
  chain_id: number;
  onchain_pool_id: bigint | null;
  expires_at: string | null;
}

export default function PoolsTab() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useAccount();

  const loadPools = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ pools: Pool[] }>('/api/admin/pools');
      setPools(data.pools);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPools();
  }, []);

  const handleHide = async (id: string) => {
    if (!confirm('Hide this pool?')) return;
    try {
      await apiFetch('/api/admin/pools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'hide', reason: 'Admin hidden' }),
      });
      await loadPools();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to hide pool');
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadPools} />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Pools Management</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: p => <span className="font-mono text-xs">{p.id.slice(0, 8)}...</span> },
          { key: 'type', label: 'Type', render: p => p.trade_type },
          { key: 'offer', label: 'Offer', render: p => `${Number(p.offer_amount).toFixed(2)} ${p.offer_symbol}`, mono: true },
          { key: 'request', label: 'Request', render: p => p.request_symbol },
          { key: 'visibility', label: 'Visibility', render: p => <StatusChip status={p.visibility.toUpperCase()} /> },
          { key: 'status', label: 'Status', render: p => <StatusChip status={p.status} /> },
          { key: 'created', label: 'Created', render: p => formatDate(p.created_at) },
          {
            key: 'actions',
            label: 'Actions',
            render: p => {
              const isExpired = p.expires_at && new Date(p.expires_at) < new Date();
              const canExpire = (p.status === 'OPEN' || p.status === 'PARTIAL') && isExpired && p.onchain_pool_id && p.chain_id;

              return (
                <div className="flex gap-2">
                  {p.status !== 'HIDDEN' && (
                    <button
                      onClick={() => handleHide(p.id)}
                      className="px-3 py-1 rounded text-xs font-bold"
                      style={{ background: '#FF4D5E40', color: '#FF4D5E', border: '1px solid #FF4D5E' }}
                    >
                      Hide
                    </button>
                  )}
                  {canExpire && (
                    <ExpireButton poolId={p.id} onchainPoolId={p.onchain_pool_id!} chainId={p.chain_id} onSuccess={loadPools} />
                  )}
                </div>
              );
            },
          },
        ]}
        data={pools}
        keyExtractor={p => p.id}
        emptyText="No pools"
      />
    </div>
  );
}

function ExpireButton({ poolId, onchainPoolId, chainId, onSuccess }: { poolId: string; onchainPoolId: bigint; chainId: number; onSuccess: () => void }) {
  const contract = useContractAdmin(chainId);
  const [confirming, setConfirming] = useState(false);

  const handleExpire = async () => {
    if (!confirm('Expire this pool on-chain?')) return;
    try {
      contract.expire(BigInt(onchainPoolId));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Transaction failed');
    }
  };

  useEffect(() => {
    if (contract.isConfirmed && contract.txHash && confirming) {
      // Try to call WS2's confirm endpoint
      fetch(`/api/pools/${poolId}/close-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: contract.txHash }),
      })
        .then(() => {
          setConfirming(false);
          onSuccess();
        })
        .catch(() => {
          // If 404, just show the hash
          alert(`Pool expired on-chain. TX: ${contract.txHash}\n\nNote: /api/pools/${poolId}/close-confirm returned error (WS2 route may not exist yet).`);
          setConfirming(false);
          onSuccess();
        });
    }
  }, [contract.isConfirmed, contract.txHash, poolId, confirming, onSuccess]);

  useEffect(() => {
    if (contract.isPending || contract.isConfirming) {
      setConfirming(true);
    }
  }, [contract.isPending, contract.isConfirming]);

  return (
    <button
      onClick={handleExpire}
      disabled={contract.isPending || contract.isConfirming}
      className="px-3 py-1 rounded text-xs font-bold"
      style={{ background: '#FFB02040', color: '#FFB020', border: '1px solid #FFB020', opacity: contract.isPending || contract.isConfirming ? 0.5 : 1 }}
    >
      {contract.isPending ? 'Confirm...' : contract.isConfirming ? 'Expiring...' : 'Expire On-Chain'}
    </button>
  );
}
