'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useEscrowWrite } from '@/hooks/useEscrowVault';
import { useTxTracker } from '@/hooks/useTxTracker';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { escrowVaultAddress } from '@/lib/contracts/addresses';

export function DisputeModal({
  isOpen,
  onClose,
  tradeId,
  onchainTradeId,
  onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  tradeId: string;
  onchainTradeId: number | null;
  onUpdate: () => void;
}) {
  const { chain } = useAccount();
  const vaultAddress = chain?.id ? escrowVaultAddress(chain.id) : null;
  const { write: escrowWrite, hash: escrowHash, isPending, isConfirming, isSuccess } = useEscrowWrite();
  const { track, confirm } = useTxTracker();

  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'uploading' | 'submitting' | 'done'>('form');

  const handleSubmit = async () => {
    if (!note.trim()) {
      setError('Please provide a reason for the dispute');
      return;
    }

    if (!file) {
      setError('Please upload evidence (screenshot, receipt, etc.)');
      return;
    }

    if (!onchainTradeId || !vaultAddress) {
      setError('Trade not ready for dispute');
      return;
    }

    setError(null);
    setStep('uploading');

    try {
      // Upload evidence file
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch(`/api/trades/${tradeId}/evidence`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || 'Failed to upload evidence');
      }

      const { keccak256: evidenceHash } = await uploadRes.json();

      // Call raiseDispute on-chain
      setStep('submitting');

      escrowWrite({
        address: vaultAddress,
        abi: escrowVaultAbi,
        functionName: 'raiseDispute',
        args: [BigInt(onchainTradeId), evidenceHash as `0x${string}`],
      });

      // Wait for tx success
      const waitForSuccess = setInterval(() => {
        if (isSuccess) {
          clearInterval(waitForSuccess);
          handleConfirm(evidenceHash, escrowHash!);
        }
      }, 500);

      setTimeout(() => clearInterval(waitForSuccess), 120000); // 2min timeout
    } catch (err) {
      console.error('Dispute submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit dispute');
      setStep('form');
    }
  };

  const handleConfirm = async (evidenceHash: string, txHash: Address) => {
    try {
      if (!chain?.id) return;

      await track({ chainId: chain.id, hash: txHash, kind: 'fiat_dispute', refType: 'trade', refId: tradeId });
      await confirm(`/api/trades/${tradeId}/confirm`, txHash, { kind: 'fiat_dispute' });

      // Also submit dispute note to backend
      await fetch(`/api/trades/${tradeId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          evidencePaths: [evidenceHash],
          evidenceHash,
        }),
      });

      setStep('done');
      setTimeout(() => {
        onUpdate();
        onClose();
        resetForm();
      }, 2000);
    } catch (err) {
      console.error('Confirm error:', err);
      setError(err instanceof Error ? err.message : 'Failed to confirm dispute');
      setStep('form');
    }
  };

  const resetForm = () => {
    setNote('');
    setFile(null);
    setError(null);
    setStep('form');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Raise Dispute">
      <div className="space-y-4">
        {step === 'form' && (
          <>
            <div>
              <label className="block text-sm font-semibold mb-2 text-white">
                Reason for Dispute
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain why you are raising this dispute..."
                className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #1f1f1f',
                  color: '#f0f0f0',
                }}
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-white">
                Evidence (Image or PDF)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #1f1f1f',
                  color: '#f0f0f0',
                }}
              />
              <p className="text-xs mt-2" style={{ color: '#666' }}>
                Max 10MB. Upload screenshots, receipts, or other proof.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.2)' }}>
                <p className="text-xs font-semibold" style={{ color: '#FF4D5E' }}>{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!note.trim() || !file || step !== 'form'}
              className="w-full py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#fb923c', color: '#000' }}
            >
              Submit Dispute
            </button>
          </>
        )}

        {step === 'uploading' && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: '#00c9a7' }} />
            <p className="text-sm" style={{ color: '#888' }}>Uploading evidence...</p>
          </div>
        )}

        {step === 'submitting' && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: '#00c9a7' }} />
            <p className="text-sm" style={{ color: '#888' }}>
              {isPending && 'Waiting for signature...'}
              {isConfirming && 'Confirming transaction...'}
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-lg font-semibold text-white mb-2">Dispute Submitted</p>
            <p className="text-sm" style={{ color: '#888' }}>
              An arbitrator will review your case.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
