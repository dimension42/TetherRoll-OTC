'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { type CustodyLeg } from './types';
import { ExactAmount } from './ExactAmount';

/**
 * LegCard — Displays a single custody leg (CRYPTO or FIAT)
 * Shows deposit instructions for the owner's obligation leg
 * Shows read-only status for counterparty's leg
 */
export function LegCard({ leg, isOwner }: { leg: CustodyLeg; isOwner: boolean }) {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopyAddress = () => {
    if (!leg.instructions?.depositAddress) return;
    navigator.clipboard.writeText(leg.instructions.depositAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleSubmitTxHash = async () => {
    if (!txHash.trim()) {
      setError('Please enter a transaction hash');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/trades/${leg.trade_id}/legs/${leg.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: txHash.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to submit: ${res.status}`);
      }

      // Refresh page to show updated state
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSent = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/trades/${leg.trade_id}/legs/${leg.id}/sent`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReceived = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/trades/${leg.trade_id}/legs/${leg.id}/received`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const explorerUrl = leg.tx_hash && leg.asset?.explorer_tx_url
    ? leg.asset.explorer_tx_url.replace('{hash}', leg.tx_hash)
    : null;

  // Status chip
  const statusConfig = (() => {
    switch (leg.status) {
      case 'PENDING': return { bg: 'rgba(245,166,35,0.1)', color: '#f5a623', label: 'Pending' };
      case 'SUBMITTED': return { bg: 'rgba(99,102,241,0.1)', color: '#a78bfa', label: 'Submitted' };
      case 'CONFIRMING': return { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', label: 'Confirming...' };
      case 'CONFIRMED': return { bg: 'rgba(0,255,136,0.1)', color: '#00ff88', label: 'Confirmed' };
      case 'FAILED': return { bg: 'rgba(255,68,102,0.1)', color: '#ff4466', label: 'Failed' };
      case 'REFUNDED': return { bg: 'rgba(136,136,136,0.1)', color: '#888', label: 'Refunded' };
      case 'SENT': return { bg: 'rgba(99,102,241,0.1)', color: '#a78bfa', label: 'Sent (KRW)' };
      case 'RECEIVED': return { bg: 'rgba(0,255,136,0.1)', color: '#00ff88', label: 'Received (KRW)' };
      default: return { bg: 'rgba(255,255,255,0.05)', color: '#888', label: leg.status };
    }
  })();

  return (
    <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#888' }}>
            {isOwner ? 'Your Obligation' : "Counterparty's Leg"}
          </p>
          <p className="text-lg font-bold text-white mt-1">
            {leg.kind === 'CRYPTO' ? `${leg.asset?.symbol || '?'} (${leg.asset?.chain_name || '?'})` : `${leg.fiat_currency || 'KRW'} (Bank Transfer)`}
          </p>
        </div>
        <span
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{
            background: statusConfig.bg,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.color}33`,
          }}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* CRYPTO leg — owner's obligation */}
      {leg.kind === 'CRYPTO' && isOwner && leg.instructions && (
        <div className="space-y-4">
          {/* QR Code */}
          <div className="flex justify-center p-4 rounded-xl" style={{ background: '#fff' }}>
            <QRCodeSVG value={leg.instructions.qr} size={160} level="M" />
          </div>

          {/* Deposit Address */}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#888' }}>
              Deposit Address (플랫폼 주소)
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#050806', border: '1px solid #2a2a2a' }}>
              <p className="flex-1 font-mono text-sm text-white break-all">{leg.instructions.depositAddress}</p>
              <button
                onClick={handleCopyAddress}
                className="shrink-0 p-2 rounded transition-all"
                style={{ background: copiedAddress ? 'rgba(0,255,136,0.15)' : 'rgba(0,201,167,0.1)', color: copiedAddress ? '#00ff88' : '#00c9a7' }}
              >
                {copiedAddress ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Exact Amount */}
          <ExactAmount amount={leg.instructions.exactAmountFormatted} symbol={leg.asset?.symbol || ''} />

          {/* Min Confirmations */}
          {leg.min_confirmations && (
            <div className="p-3 rounded-lg" style={{ background: '#050806' }}>
              <p className="text-xs" style={{ color: '#888' }}>
                Required Confirmations: <span className="font-mono font-semibold text-white">{leg.min_confirmations}</span>
              </p>
            </div>
          )}

          {/* TX Hash Submit Form */}
          {leg.status === 'PENDING' && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#888' }}>
                Submit Transaction Hash
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-mono"
                  style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                  placeholder="0x..."
                  value={txHash}
                  onChange={e => setTxHash(e.target.value)}
                />
                <button
                  onClick={handleSubmitTxHash}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: submitting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00c9a7, #00a88a)',
                    color: submitting ? '#555' : '#000',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
              {error && (
                <p className="text-xs mt-2" style={{ color: '#ff4466' }}>⚠️ {error}</p>
              )}
            </div>
          )}

          {/* Confirmation Progress */}
          {leg.status === 'CONFIRMING' && leg.confirmations !== undefined && leg.min_confirmations && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#60a5fa' }}>
                Confirmations: {leg.confirmations} / {leg.min_confirmations}
              </p>
              <div className="w-full h-2 rounded-full" style={{ background: '#1a1a1a' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((leg.confirmations / leg.min_confirmations) * 100, 100)}%`,
                    background: 'linear-gradient(90deg, #60a5fa, #00c9a7)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Explorer Link */}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-white/5"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#a78bfa', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <ExternalLink size={14} />
              View on Explorer
            </a>
          )}
        </div>
      )}

      {/* FIAT leg — owner's obligation */}
      {leg.kind === 'FIAT' && isOwner && leg.bankInfo && (
        <div className="space-y-4">
          {/* Bank Info */}
          <div className="p-4 rounded-xl" style={{ background: '#050806', border: '1px solid #2a2a2a' }}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: '#888' }}>
              송금할 계좌 정보
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: '#888' }}>은행</span>
                <span className="font-semibold text-white">{leg.bankInfo.bank}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#888' }}>계좌번호</span>
                <span className="font-mono font-semibold text-white">{leg.bankInfo.account}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#888' }}>예금주</span>
                <span className="font-semibold text-white">{leg.bankInfo.holder}</span>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.2)' }}>
            <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00c9a7' }}>
              송금 금액
            </p>
            <p className="text-3xl font-black font-mono text-white">
              ₩{parseFloat(leg.amount).toLocaleString('ko-KR')}
            </p>
          </div>

          {/* Mark Sent Button */}
          {leg.status === 'PENDING' && (
            <button
              onClick={handleMarkSent}
              disabled={submitting}
              className="w-full px-6 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: submitting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00c9a7, #00a88a)',
                color: submitting ? '#555' : '#000',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Processing...' : 'I have sent KRW (송금했습니다)'}
            </button>
          )}

          {error && (
            <p className="text-xs" style={{ color: '#ff4466' }}>⚠️ {error}</p>
          )}
        </div>
      )}

      {/* FIAT leg — counterparty (receive KRW) */}
      {leg.kind === 'FIAT' && !isOwner && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: '#050806', border: '1px solid #2a2a2a' }}>
            <p className="text-sm" style={{ color: '#888' }}>
              Counterparty will send <span className="font-mono font-semibold text-white">₩{parseFloat(leg.amount).toLocaleString('ko-KR')}</span> to your bank account.
            </p>
          </div>

          {/* Mark Received Button */}
          {leg.status === 'SENT' && (
            <button
              onClick={handleMarkReceived}
              disabled={submitting}
              className="w-full px-6 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: submitting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00ff88, #00c9a7)',
                color: submitting ? '#555' : '#000',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Processing...' : 'I received KRW (수령했습니다)'}
            </button>
          )}

          {error && (
            <p className="text-xs" style={{ color: '#ff4466' }}>⚠️ {error}</p>
          )}
        </div>
      )}

      {/* Read-only for counterparty's CRYPTO leg */}
      {leg.kind === 'CRYPTO' && !isOwner && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg" style={{ background: '#050806' }}>
            <p className="text-xs mb-1" style={{ color: '#888' }}>Amount</p>
            <p className="text-base font-mono font-semibold text-white">{leg.amount_with_suffix || leg.amount} {leg.asset?.symbol}</p>
          </div>
          {leg.tx_hash && (
            <div className="p-3 rounded-lg" style={{ background: '#050806' }}>
              <p className="text-xs mb-1" style={{ color: '#888' }}>TX Hash</p>
              <p className="text-xs font-mono text-white break-all">{leg.tx_hash}</p>
            </div>
          )}
          {leg.confirmations !== undefined && leg.min_confirmations && (
            <div className="p-3 rounded-lg" style={{ background: '#050806' }}>
              <p className="text-xs mb-1" style={{ color: '#888' }}>Confirmations</p>
              <p className="text-sm font-semibold text-white">{leg.confirmations} / {leg.min_confirmations}</p>
            </div>
          )}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#a78bfa', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <ExternalLink size={12} />
              View on Explorer
            </a>
          )}
        </div>
      )}

      {/* Note */}
      {leg.note && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#f5a623' }}>Note</p>
          <p className="text-xs text-white">{leg.note}</p>
        </div>
      )}
    </div>
  );
}
