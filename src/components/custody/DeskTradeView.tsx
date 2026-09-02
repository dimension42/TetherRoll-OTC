'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { type DeskTrade } from './types';
import { DeskTimeline } from './DeskTimeline';
import { LegCard } from './LegCard';
import { Countdown } from '@/components/ui/Countdown';
import { useAuth } from '@/hooks/useAuth';

/**
 * DeskTradeView — Trade detail view for DESK trades (custody escrow)
 * Shows timeline, leg cards, payouts, and actions (cancel, dispute)
 */
export function DeskTradeView({ trade }: { trade: DeskTrade }) {
  const { user } = useAuth();
  const [cancelling, setCancelling] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  const myLegs = trade.legs?.filter(leg => leg.owner_id === user?.id) || [];
  const counterpartyLegs = trade.legs?.filter(leg => leg.owner_id !== user?.id) || [];

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this trade? If counterparty has already deposited, they must also agree to cancel.')) return;

    setError(null);
    setCancelling(true);

    try {
      const res = await fetch(`/api/trades/${trade.id}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      const result = await res.json();
      if (result.pending) {
        alert('Cancel request sent. Waiting for counterparty agreement.');
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeNote.trim()) {
      setError('Please explain the issue');
      return;
    }

    setError(null);
    setDisputing(true);

    try {
      const res = await fetch(`/api/trades/${trade.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: disputeNote }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      alert('Dispute raised. Admin will review and contact you.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to raise dispute');
    } finally {
      setDisputing(false);
    }
  };

  const canCancel = ['PENDING', 'AWAITING_DEPOSITS'].includes(trade.status);
  const canDispute = ['AWAITING_DEPOSITS', 'DEPOSITED', 'PAYOUT_PENDING'].includes(trade.status);

  // Pair info
  const offerLeg = trade.legs?.find(l => l.side === 'OFFER');
  const requestLeg = trade.legs?.find(l => l.side === 'REQUEST');

  const offerSymbol = offerLeg?.kind === 'CRYPTO' ? offerLeg.asset?.symbol : offerLeg?.fiat_currency;
  const requestSymbol = requestLeg?.kind === 'CRYPTO' ? requestLeg.asset?.symbol : requestLeg?.fiat_currency;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header Card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #f5a623, #00c9a7, #00ff88)' }} />

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                Desk Trade (Platform Custody)
              </p>
              <p className="text-2xl font-black text-white">
                {offerSymbol} → {requestSymbol}
              </p>
            </div>
            <span
              className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{
                background: 'rgba(245,166,35,0.1)',
                color: '#f5a623',
                border: '1px solid rgba(245,166,35,0.2)',
              }}
            >
              {trade.status}
            </span>
          </div>

          {/* Deadline */}
          {trade.deadline && (
            <div className="p-3 rounded-lg" style={{ background: '#050806' }}>
              <p className="text-xs" style={{ color: '#888' }}>
                Deadline: <span className="font-semibold text-white"><Countdown until={trade.deadline} /></span>
              </p>
            </div>
          )}

          {/* Notice */}
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <p className="text-xs" style={{ color: '#a78bfa' }}>
              ℹ️ 이 거래의 자산은 플랫폼 지갑이 보관합니다 (컨트랙트 에스크로 아님). 양측 입금 확인 후 어드민이 지급을 처리합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
        <h3 className="text-lg font-bold text-white mb-6">Trade Progress</h3>
        <DeskTimeline status={trade.status} />
      </div>

      {/* My Legs */}
      {myLegs.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Your Obligations</h3>
          <div className="space-y-4">
            {myLegs.map(leg => (
              <LegCard key={leg.id} leg={leg} isOwner={true} />
            ))}
          </div>
        </div>
      )}

      {/* Counterparty Legs */}
      {counterpartyLegs.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Counterparty Status</h3>
          <div className="space-y-4">
            {counterpartyLegs.map(leg => (
              <LegCard key={leg.id} leg={leg} isOwner={false} />
            ))}
          </div>
        </div>
      )}

      {/* Payouts */}
      {trade.payouts && trade.payouts.length > 0 && (
        <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
          <h3 className="text-lg font-bold text-white mb-4">Payouts</h3>
          <div className="space-y-3">
            {trade.payouts.map(payout => (
              <div key={payout.id} className="p-4 rounded-xl" style={{ background: '#050806', border: '1px solid #2a2a2a' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{payout.purpose === 'SETTLE' ? 'Settlement' : 'Refund'}</p>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      background: payout.status === 'VERIFIED' ? 'rgba(0,255,136,0.1)' : payout.status === 'FAILED' ? 'rgba(255,68,102,0.1)' : 'rgba(245,166,35,0.1)',
                      color: payout.status === 'VERIFIED' ? '#00ff88' : payout.status === 'FAILED' ? '#ff4466' : '#f5a623',
                    }}
                  >
                    {payout.status}
                  </span>
                </div>
                <div className="text-xs space-y-1" style={{ color: '#888' }}>
                  <p>To: <span className="font-mono text-white">{payout.to_address}</span></p>
                  <p>Amount: <span className="font-mono text-white">{payout.amount}</span></p>
                  {payout.tx_hash && (
                    <p>
                      TX: <span className="font-mono text-white">{payout.tx_hash.slice(0, 16)}...</span>
                    </p>
                  )}
                  {payout.explorer_url && (
                    <a href={payout.explorer_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      View on Explorer
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="px-6 py-3 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: cancelling ? 'rgba(255,255,255,0.03)' : 'rgba(255,68,102,0.1)',
              color: cancelling ? '#555' : '#ff4466',
              border: `1px solid ${cancelling ? 'rgba(255,255,255,0.05)' : 'rgba(255,68,102,0.2)'}`,
              cursor: cancelling ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Trade'}
          </button>
        )}

        {canDispute && (
          <button
            onClick={() => setShowDisputeModal(true)}
            className="px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:bg-white/5"
            style={{
              background: 'rgba(251,146,60,0.1)',
              color: '#fb923c',
              border: '1px solid rgba(251,146,60,0.2)',
            }}
          >
            <AlertTriangle size={16} className="inline mr-2" />
            Raise Dispute
          </button>
        )}

        {error && (
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.2)' }}>
            <p className="text-sm" style={{ color: '#ff4466' }}>⚠️ {error}</p>
          </div>
        )}
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowDisputeModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full p-6 rounded-2xl"
            style={{ background: '#111', border: '1px solid #2a2a2a' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">Raise Dispute</h3>
            <p className="text-sm mb-4" style={{ color: '#888' }}>
              Explain the issue. An admin will review and contact you.
            </p>
            <textarea
              className="w-full px-4 py-3 rounded-lg text-sm mb-4"
              style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0', minHeight: '120px' }}
              placeholder="Describe the problem..."
              value={disputeNote}
              onChange={e => setDisputeNote(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #2a2a2a' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={disputing}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: disputing ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #fb923c, #f59e0b)',
                  color: disputing ? '#555' : '#000',
                  cursor: disputing ? 'not-allowed' : 'pointer',
                }}
              >
                {disputing ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
