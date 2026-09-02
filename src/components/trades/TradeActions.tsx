'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import { Loader2 } from 'lucide-react';
import { type Trade, type TradeStatus } from '@/lib/types';
import { useEscrowWrite } from '@/hooks/useEscrowVault';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useTxTracker } from '@/hooks/useTxTracker';
import { TxStepper } from '@/components/ui/TxStepper';
import { Countdown } from '@/components/ui/Countdown';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { escrowVaultAddress } from '@/lib/contracts/addresses';
import { isNative } from '@/lib/tokens';
import { txUrl } from '@/lib/chains';
import { DisputeModal } from './DisputeModal';
import { ConfirmModal } from './ConfirmModal';

type OnchainTrade = {
  seller: Address;
  buyer: Address;
  token: Address;
  amount: bigint;
  bondToken: Address;
  bondAmount: bigint;
  deadline: bigint;
  releaseWindow: bigint;
  paidAt: bigint;
  feeBps: number;
  status: number;
  evidenceHash: string;
};

export function TradeActions({
  trade,
  onchainTrade: _onchainTrade,
  effectiveStatus,
  isSeller,
  isBuyer,
  onUpdate,
}: {
  trade: Trade;
  onchainTrade?: OnchainTrade;
  effectiveStatus: TradeStatus;
  isSeller: boolean;
  isBuyer: boolean;
  onUpdate: () => void;
}) {
  const { address: userAddress, chain } = useAccount();
  const vaultAddress = escrowVaultAddress(trade.chain_id);
  const { write: escrowWrite, hash: escrowHash, isPending, isConfirming, isSuccess } = useEscrowWrite();
  const { track, confirm } = useTxTracker();

  const [txSteps, setTxSteps] = useState<Array<{ label: string; status: 'pending' | 'active' | 'success' | 'error'; txHash?: string; chainId?: number; error?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');

  const requiredAddress = isSeller ? trade.seller_address : trade.buyer_address;
  const isWalletCorrect = userAddress?.toLowerCase() === requiredAddress.toLowerCase();
  const isChainCorrect = chain?.id === trade.chain_id;

  // Amounts for approval
  const createAmount = trade.amount_wei
    ? BigInt(trade.amount_wei)
    : BigInt(0);
  const joinAmount = BigInt(trade.bond_amount_wei || '0');

  // Approval hook for create (seller)
  const {
    needsApproval: needsCreateApproval,
    approve: approveCreate,
    isApproving: isCreatingApproving,
    isConfirming: isCreateApprovalConfirming,
    isSuccess: isCreateApprovalSuccess,
  } = useTokenApproval(
    effectiveStatus === 'PENDING' && isSeller ? (trade.token as Address) : null,
    vaultAddress,
    createAmount
  );

  // Approval hook for join (buyer)
  const {
    needsApproval: needsJoinApproval,
    approve: approveJoin,
    isApproving: isJoinApproving,
    isConfirming: isJoinApprovalConfirming,
    isSuccess: isJoinApprovalSuccess,
  } = useTokenApproval(
    effectiveStatus === 'AWAITING_BOND' && isBuyer ? (trade.bond_token as Address) : null,
    vaultAddress,
    joinAmount
  );

  // Handle approval success
  useEffect(() => {
    if (isCreateApprovalSuccess && txSteps[0]?.status === 'active') {
      setTxSteps(prev => {
        const next = [...prev];
        next[0] = { ...next[0], status: 'success' };
        if (next[1]) next[1] = { ...next[1], status: 'active' };
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateApprovalSuccess]);

  useEffect(() => {
    if (isJoinApprovalSuccess && txSteps[0]?.status === 'active') {
      setTxSteps(prev => {
        const next = [...prev];
        next[0] = { ...next[0], status: 'success' };
        if (next[1]) next[1] = { ...next[1], status: 'active' };
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoinApprovalSuccess]);

  // Handle tx broadcast
  useEffect(() => {
    if (escrowHash && txSteps.length > 0) {
      const idx = (needsCreateApproval || needsJoinApproval) ? 1 : 0;
      setTxSteps(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], txHash: escrowHash, chainId: trade.chain_id, status: 'active' };
        return next;
      });
      track({ chainId: trade.chain_id, hash: escrowHash, kind: currentAction, refType: 'trade', refId: trade.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrowHash]);

  // Handle tx confirmation
  useEffect(() => {
    if (isSuccess && txSteps.length > 0) {
      const idx = (needsCreateApproval || needsJoinApproval) ? 1 : 0;
      setTxSteps(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'success' };
        return next;
      });
      handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const handleConfirm = async () => {
    if (!escrowHash) return;
    try {
      await confirm(`/api/trades/${trade.id}/confirm`, escrowHash, { kind: currentAction });
      onUpdate();
      setTxSteps([]);
      setCurrentAction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    }
  };

  const handleCreateFiatTrade = () => {
    if (!vaultAddress || !userAddress) return;
    setError(null);
    setCurrentAction('fiat_create');

    const steps = needsCreateApproval
      ? [
          { label: 'Approve token', status: 'active' as const },
          { label: 'Create trade', status: 'pending' as const },
        ]
      : [{ label: 'Create trade', status: 'active' as const }];

    setTxSteps(steps);

    if (needsCreateApproval) {
      approveCreate();
    } else {
      executeCreate();
    }
  };

  const executeCreate = () => {
    if (!vaultAddress) return;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h
    const releaseWindow = BigInt(86400); // 24h

    const isNativeToken = isNative(trade.token);
    const value = isNativeToken ? createAmount : BigInt(0);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'createFiatTrade',
      args: [
        trade.buyer_address as Address,
        trade.token as Address,
        createAmount,
        trade.bond_token as Address,
        BigInt(trade.bond_amount_wei || '0'),
        deadline,
        releaseWindow,
      ],
      value,
    });
  };

  useEffect(() => {
    if (isCreateApprovalSuccess && currentAction === 'fiat_create') {
      executeCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateApprovalSuccess, currentAction]);

  const handleJoinFiatTrade = () => {
    if (!vaultAddress || !trade.onchain_trade_id) return;
    setError(null);
    setCurrentAction('fiat_join');

    const steps = needsJoinApproval
      ? [
          { label: 'Approve bond token', status: 'active' as const },
          { label: 'Lock bond', status: 'pending' as const },
        ]
      : [{ label: 'Lock bond', status: 'active' as const }];

    setTxSteps(steps);

    if (needsJoinApproval) {
      approveJoin();
    } else {
      executeJoin();
    }
  };

  const executeJoin = () => {
    if (!vaultAddress || !trade.onchain_trade_id) return;

    const isNativeBond = isNative(trade.bond_token);
    const value = isNativeBond ? joinAmount : BigInt(0);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'joinFiatTrade',
      args: [BigInt(trade.onchain_trade_id)],
      value,
    });
  };

  useEffect(() => {
    if (isJoinApprovalSuccess && currentAction === 'fiat_join') {
      executeJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJoinApprovalSuccess, currentAction]);

  const handleMarkPaid = async () => {
    if (!vaultAddress || !trade.onchain_trade_id) return;
    setError(null);
    setCurrentAction('fiat_paid');
    setTxSteps([{ label: 'Mark as paid', status: 'active' }]);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'markPaid',
      args: [BigInt(trade.onchain_trade_id)],
    });
  };

  const handleConfirmReceived = () => {
    setConfirmModalOpen(true);
  };

  const executeConfirmReceived = async () => {
    if (!vaultAddress || !trade.onchain_trade_id) return;
    setError(null);
    setCurrentAction('fiat_release');
    setTxSteps([{ label: 'Confirm received & release', status: 'active' }]);
    setConfirmModalOpen(false);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'confirmReceived',
      args: [BigInt(trade.onchain_trade_id)],
    });
  };

  const handleCancel = async () => {
    if (!vaultAddress || !trade.onchain_trade_id) return;
    setError(null);
    setCurrentAction('fiat_cancel');
    setTxSteps([{ label: 'Cancel trade', status: 'active' }]);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'cancelFiatTrade',
      args: [BigInt(trade.onchain_trade_id)],
    });
  };

  const handleExpire = async () => {
    if (!vaultAddress || !trade.onchain_trade_id) return;
    setError(null);
    setCurrentAction('fiat_expire');
    setTxSteps([{ label: 'Expire trade', status: 'active' }]);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'expireFiatTrade',
      args: [BigInt(trade.onchain_trade_id)],
    });
  };

  const handleEscalate = async () => {
    if (!vaultAddress || !trade.onchain_trade_id) return;
    setError(null);
    setCurrentAction('fiat_dispute');
    setTxSteps([{ label: 'Escalate to arbitration', status: 'active' }]);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'escalateUnreleased',
      args: [BigInt(trade.onchain_trade_id)],
    });
  };

  // Check deadlines
  const now = Math.floor(Date.now() / 1000);
  const deadlineTimestamp = new Date(trade.deadline).getTime();
  const isPastDeadline = now >= deadlineTimestamp / 1000;
  const releaseWindowEnd = trade.paid_at
    ? new Date(trade.paid_at).getTime() / 1000 + trade.release_window_sec
    : 0;
  const isPastReleaseWindow = trade.paid_at && now >= releaseWindowEnd;

  if (!isWalletCorrect) {
    return (
      <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <p className="text-center" style={{ color: '#f5a623' }}>
          Please switch to wallet <span className="font-mono">{requiredAddress.slice(0, 10)}...{requiredAddress.slice(-8)}</span>
        </p>
      </div>
    );
  }

  if (!isChainCorrect) {
    return (
      <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <p className="text-center" style={{ color: '#f5a623' }}>
          Please switch to the correct chain
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Transaction Stepper */}
      {txSteps.length > 0 && (
        <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <TxStepper steps={txSteps} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.2)' }}>
          <p className="text-sm font-semibold" style={{ color: '#FF4D5E' }}>{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <h3 className="text-lg font-bold text-white mb-4">Actions</h3>

        <div className="space-y-3">
          {/* Seller, PENDING: Create on-chain trade */}
          {isSeller && effectiveStatus === 'PENDING' && !trade.onchain_trade_id && (
            <button
              onClick={handleCreateFiatTrade}
              disabled={isPending || isConfirming || isCreatingApproving || isCreateApprovalConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#00c9a7', color: '#000' }}
            >
              {isPending || isConfirming || isCreatingApproving || isCreateApprovalConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                'Open On-Chain Trade'
              )}
            </button>
          )}

          {/* Buyer, AWAITING_BOND: Lock bond */}
          {isBuyer && effectiveStatus === 'AWAITING_BOND' && (
            <button
              onClick={handleJoinFiatTrade}
              disabled={isPending || isConfirming || isJoinApproving || isJoinApprovalConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#00c9a7', color: '#000' }}
            >
              {isPending || isConfirming || isJoinApproving || isJoinApprovalConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                'Lock Bond'
              )}
            </button>
          )}

          {/* Buyer, ACTIVE: Mark paid */}
          {isBuyer && effectiveStatus === 'ACTIVE' && !isPastDeadline && (
            <button
              onClick={handleMarkPaid}
              disabled={isPending || isConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#00c9a7', color: '#000' }}
            >
              {isPending || isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                'I Have Sent KRW'
              )}
            </button>
          )}

          {/* Seller, ACTIVE or PAID: Confirm received */}
          {isSeller && (effectiveStatus === 'ACTIVE' || effectiveStatus === 'PAID') && (
            <button
              onClick={handleConfirmReceived}
              disabled={isPending || isConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#00c9a7', color: '#000' }}
            >
              I Received KRW → Release Crypto
            </button>
          )}

          {/* Either, ACTIVE or PAID: Raise dispute */}
          {(effectiveStatus === 'ACTIVE' || effectiveStatus === 'PAID') && (
            <button
              onClick={() => setDisputeModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}
            >
              Raise Dispute
            </button>
          )}

          {/* Cancel (mutual or seller alone in AWAITING_BOND) */}
          {effectiveStatus === 'ACTIVE' && (
            <button
              onClick={handleCancel}
              disabled={isPending || isConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(255,68,102,0.15)', color: '#ff4466', border: '1px solid rgba(255,68,102,0.3)' }}
            >
              Request Cancel (Mutual)
            </button>
          )}

          {isSeller && effectiveStatus === 'AWAITING_BOND' && (
            <button
              onClick={handleCancel}
              disabled={isPending || isConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(255,68,102,0.15)', color: '#ff4466', border: '1px solid rgba(255,68,102,0.3)' }}
            >
              Cancel Trade
            </button>
          )}

          {/* Expire (anyone, past deadline) */}
          {(effectiveStatus === 'AWAITING_BOND' || effectiveStatus === 'ACTIVE') && isPastDeadline && (
            <button
              onClick={handleExpire}
              disabled={isPending || isConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(136,136,136,0.15)', color: '#888', border: '1px solid rgba(136,136,136,0.3)' }}
            >
              Expire Trade
            </button>
          )}

          {/* Escalate (anyone, past release window) */}
          {effectiveStatus === 'PAID' && isPastReleaseWindow && (
            <button
              onClick={handleEscalate}
              disabled={isPending || isConfirming}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}
            >
              Escalate to Arbitration
            </button>
          )}

          {/* Deadline countdown */}
          {!isPastDeadline && (effectiveStatus === 'AWAITING_BOND' || effectiveStatus === 'ACTIVE') && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-xs mb-1" style={{ color: '#666' }}>Time remaining:</p>
              <p className="font-mono font-semibold">
                <Countdown until={trade.deadline} />
              </p>
            </div>
          )}

          {/* Release window countdown */}
          {effectiveStatus === 'PAID' && trade.paid_at && !isPastReleaseWindow && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-xs mb-1" style={{ color: '#666' }}>Seller must confirm within:</p>
              <p className="font-mono font-semibold">
                <Countdown until={new Date(releaseWindowEnd * 1000)} />
              </p>
            </div>
          )}
        </div>

        {/* DISPUTED: info */}
        {effectiveStatus === 'DISPUTED' && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }}>
            <p className="text-sm font-semibold" style={{ color: '#fb923c' }}>
              This trade is under arbitration. An arbitrator will review the evidence and make a final decision.
            </p>
            {trade.evidence_hash && (
              <p className="text-xs mt-2 font-mono" style={{ color: '#666' }}>
                Evidence: {trade.evidence_hash.slice(0, 20)}...
              </p>
            )}
          </div>
        )}

        {/* RESOLVED/RELEASED: info */}
        {(effectiveStatus === 'RESOLVED' || effectiveStatus === 'RELEASED') && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.2)' }}>
            <p className="text-sm font-semibold" style={{ color: '#00c9a7' }}>
              Trade completed successfully.
            </p>
            {trade.tx_hash && (
              <a
                href={txUrl(trade.chain_id, trade.tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mt-2 inline-block font-mono hover:underline"
                style={{ color: '#00c9a7' }}
              >
                View transaction →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <DisputeModal
        isOpen={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        tradeId={trade.id}
        onchainTradeId={trade.onchain_trade_id}
        onUpdate={onUpdate}
      />

      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={executeConfirmReceived}
        title="Confirm KRW Receipt"
        message="I confirm that I have received the full KRW payment. This action will release the crypto to the buyer and cannot be undone."
      />
    </div>
  );
}
