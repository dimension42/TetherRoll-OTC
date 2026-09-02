'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useEscrowWrite } from '@/hooks/useEscrowVault';
import { useTxTracker } from '@/hooks/useTxTracker';
import { useAuth } from '@/hooks/useAuth';
import { TxStepper } from '@/components/ui/TxStepper';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { escrowVaultAddress } from '@/lib/contracts/addresses';
import type { Pool } from '@/lib/types';

export function PoolActions({ pool, onSuccess }: { pool: Pool; onSuccess: () => void }) {
  const { user } = useAuth();
  const { address: userAddress } = useAccount();
  const { write, hash, isPending, isConfirming, isSuccess } = useEscrowWrite();
  const { track, confirm } = useTxTracker();

  const [action, setAction] = useState<'cancel' | 'expire' | null>(null);
  const [txSteps, setTxSteps] = useState<Array<{ label: string; status: 'pending' | 'active' | 'success' | 'error'; txHash?: string; chainId?: number; error?: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const isOwner = user?.id === pool.creator_id || (userAddress && pool.maker_address && userAddress.toLowerCase() === pool.maker_address.toLowerCase());
  const isExpired = pool.expires_at ? new Date(pool.expires_at) <= new Date() : false;
  const canCancel = isOwner && (pool.status === 'OPEN' || pool.status === 'PARTIAL');
  const canExpire = isExpired && (pool.status === 'OPEN' || pool.status === 'PARTIAL');

  const handleAction = async (actionType: 'cancel' | 'expire') => {
    if (!pool.onchain_pool_id) {
      // DB-only DRAFT 풀 — POST /api/pools/[id]/cancel
      try {
        setAction(actionType);
        setError(null);
        const res = await fetch(`/api/pools/${pool.id}/cancel`, { method: 'POST' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Cancel failed: ${res.status}`);
        }
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Cancel failed');
      }
      return;
    }

    // 온체인 풀
    setAction(actionType);
    setError(null);
    setTxSteps([
      { label: actionType === 'cancel' ? 'Cancelling pool' : 'Expiring pool', status: 'pending' },
      { label: 'Confirming on-chain', status: 'pending' },
    ]);

    try {
      const vaultAddress = escrowVaultAddress(pool.chain_id);
      if (!vaultAddress) throw new Error('Contract not deployed on this chain');

      write({
        address: vaultAddress,
        abi: escrowVaultAbi,
        functionName: actionType,
        args: [BigInt(pool.onchain_pool_id)],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setTxSteps(prev => {
        const next = [...prev];
        next[0] = { ...next[0], status: 'error', error: err instanceof Error ? err.message : 'Failed' };
        return next;
      });
    }
  };

  // 트랜잭션 해시 생성 시
  if (hash && txSteps[0]?.status === 'pending') {
    setTxSteps(prev => {
      const next = [...prev];
      next[0] = { ...next[0], status: 'active', txHash: hash, chainId: pool.chain_id };
      return next;
    });
    track({ chainId: pool.chain_id, hash, kind: action === 'cancel' ? 'pool_cancel' : 'pool_expire', refType: 'pool', refId: pool.id });
  }

  // 온체인 확인 완료 시
  if (isSuccess && txSteps[0]?.status === 'active' && action) {
    setTxSteps(prev => {
      const next = [...prev];
      next[0] = { ...next[0], status: 'success' };
      next[1] = { ...next[1], status: 'active' };
      return next;
    });

    // confirm 엔드포인트 호출
    (async () => {
      try {
        await confirm(`/api/pools/${pool.id}/close-confirm`, hash!);
        setTxSteps(prev => {
          const next = [...prev];
          next[1] = { ...next[1], status: 'success' };
          return next;
        });
        setTimeout(() => onSuccess(), 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Confirm failed');
        setTxSteps(prev => {
          const next = [...prev];
          next[1] = { ...next[1], status: 'error', error: err instanceof Error ? err.message : 'Failed' };
          return next;
        });
      }
    })();
  }

  if (pool.status === 'DRAFT' && !pool.onchain_pool_id && isOwner) {
    return (
      <div className="p-4 rounded-xl" style={{ background: 'rgba(136,136,136,0.1)', border: '1px solid #2a2a2a' }}>
        <p className="text-sm mb-3" style={{ color: '#888' }}>
          This pool was never locked on-chain.
        </p>
        <button
          onClick={() => handleAction('cancel')}
          disabled={action !== null}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: 'rgba(255,77,94,0.1)',
            color: '#FF4D5E',
            border: '1px solid rgba(255,77,94,0.2)',
            cursor: action !== null ? 'not-allowed' : 'pointer',
          }}
        >
          {action === 'cancel' ? 'Cancelling...' : 'Cancel Pool (DB)'}
        </button>
        {error && <p className="text-xs mt-2" style={{ color: '#FF4D5E' }}>{error}</p>}
      </div>
    );
  }

  if (!canCancel && !canExpire) return null;

  return (
    <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
      <h3 className="text-lg font-bold text-white mb-4">Pool Actions</h3>

      {txSteps.length > 0 ? (
        <div className="mb-4">
          <TxStepper steps={txSteps} />
        </div>
      ) : (
        <div className="flex gap-3">
          {canCancel && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={isPending || isConfirming}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: 'rgba(255,77,94,0.1)',
                color: '#FF4D5E',
                border: '1px solid rgba(255,77,94,0.2)',
                cursor: isPending || isConfirming ? 'not-allowed' : 'pointer',
                opacity: isPending || isConfirming ? 0.5 : 1,
              }}
            >
              Cancel Pool
            </button>
          )}
          {canExpire && (
            <button
              onClick={() => handleAction('expire')}
              disabled={isPending || isConfirming}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: 'rgba(245,166,35,0.1)',
                color: '#F5A623',
                border: '1px solid rgba(245,166,35,0.2)',
                cursor: isPending || isConfirming ? 'not-allowed' : 'pointer',
                opacity: isPending || isConfirming ? 0.5 : 1,
              }}
            >
              Expire Pool
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm mt-3" style={{ color: '#FF4D5E' }}>{error}</p>}

      {canCancel && (
        <p className="text-xs mt-3" style={{ color: '#666' }}>
          Cancelling returns your remaining offer to your wallet.
        </p>
      )}
      {canExpire && (
        <p className="text-xs mt-3" style={{ color: '#666' }}>
          This pool has expired. Anyone can trigger expiry to return the maker&apos;s funds.
        </p>
      )}
    </div>
  );
}
