'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface VipRequestStatus {
  vipStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'revoked';
  lastRequest: {
    status: 'pending' | 'approved' | 'rejected';
    reject_reason?: string;
    created_at: string;
    reviewed_at?: string;
  } | null;
}

export default function VipGate({ authenticated }: { authenticated: boolean }) {
  const [status, setStatus] = useState<VipRequestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [expectedVolume, setExpectedVolume] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authenticated) {
      fetch('/api/vip/request')
        .then(r => r.json())
        .then(data => {
          setStatus(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [authenticated]);

  const handleRequest = async () => {
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/vip/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim(),
          expectedVolume: expectedVolume.trim() || undefined,
          contact: contact.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit request');
        setSubmitting(false);
        return;
      }

      // 성공 — pending 상태로 전환
      setStatus({ vipStatus: 'pending', lastRequest: null });
      setShowModal(false);
      setReason('');
      setExpectedVolume('');
      setContact('');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#050806' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const isPending = status?.vipStatus === 'pending';
  const isRejected = status?.lastRequest?.status === 'rejected';
  const canRequest = authenticated && !isPending && (!isRejected || checkCooldown(status.lastRequest?.reviewed_at));

  return (
    <div className="min-h-screen pt-20 flex items-center justify-center px-4" style={{ background: '#050806' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        {/* 원형 도어 비주얼 */}
        <motion.div
          className="w-48 h-48 mx-auto mb-8 rounded-full relative"
          style={{
            background: 'radial-gradient(circle, #0A2E1F 0%, #050806 70%)',
            border: '3px solid #123B2A',
            boxShadow: '0 0 40px rgba(0,201,167,0.15), inset 0 0 60px rgba(0,201,167,0.05)',
          }}
          animate={{
            rotate: [0, 360],
            boxShadow: [
              '0 0 40px rgba(0,201,167,0.15), inset 0 0 60px rgba(0,201,167,0.05)',
              '0 0 50px rgba(0,201,167,0.25), inset 0 0 70px rgba(0,201,167,0.08)',
              '0 0 40px rgba(0,201,167,0.15), inset 0 0 60px rgba(0,201,167,0.05)',
            ],
          }}
          transition={{ rotate: { duration: 40, repeat: Infinity, ease: 'linear' }, boxShadow: { duration: 3, repeat: Infinity } }}
        >
          <div
            className="absolute inset-6 rounded-full"
            style={{ border: '2px solid #0F1F17', background: '#0A2E1F' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {isPending ? (
              <motion.div
                className="text-5xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ⏳
              </motion.div>
            ) : (
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="22" y="28" width="20" height="24" rx="2" stroke="#00c9a7" strokeWidth="2" />
                <path d="M26 28V20C26 15.5817 29.5817 12 34 12C38.4183 12 42 15.5817 42 20V28" stroke="#00c9a7" strokeWidth="2" />
                <circle cx="34" cy="40" r="3" fill="#00c9a7" />
              </svg>
            )}
          </div>
          {isPending && (
            <motion.div
              className="absolute -top-2 -right-2 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: '#f5a623', color: '#000' }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Under review
            </motion.div>
          )}
        </motion.div>

        {/* 라벨 */}
        <h1
          className="text-sm font-bold mb-2"
          style={{ color: '#00c9a7', letterSpacing: '0.3em', textTransform: 'uppercase' }}
        >
          Private Desk
        </h1>
        <p className="text-sm mb-8" style={{ color: '#8FA398' }}>
          Access by approval only.
        </p>

        {/* 버튼 영역 */}
        {!authenticated && (
          <button
            onClick={() => (window.location.href = '/login')}
            className="px-8 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)', color: '#000' }}
          >
            Sign in to continue
          </button>
        )}

        {authenticated && isPending && (
          <div
            className="p-4 rounded-xl"
            style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', color: '#f5a623' }}
          >
            Your request is under review. You will be notified once approved.
          </div>
        )}

        {authenticated && isRejected && (
          <div className="space-y-3">
            <div
              className="p-4 rounded-xl text-left"
              style={{ background: 'rgba(255,77,94,0.08)', border: '1px solid rgba(255,77,94,0.2)' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: '#FF4D5E' }}>
                Request Rejected
              </p>
              {status?.lastRequest?.reject_reason && (
                <p className="text-xs" style={{ color: '#8FA398' }}>
                  {status.lastRequest.reject_reason}
                </p>
              )}
            </div>
            {checkCooldown(status?.lastRequest?.reviewed_at) ? (
              <button
                onClick={() => setShowModal(true)}
                className="px-8 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)', color: '#000' }}
              >
                Request Access
              </button>
            ) : (
              <p className="text-xs" style={{ color: '#8FA398' }}>
                You can re-apply after 7 days from rejection.
              </p>
            )}
          </div>
        )}

        {canRequest && !isPending && !isRejected && (
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)', color: '#000' }}
          >
            Request Access
          </button>
        )}
      </motion.div>

      {/* 요청 모달 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setShowModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full p-6 rounded-2xl"
            style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-4">Request VIP Access</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#8FA398' }}>
                  Reason for access <span style={{ color: '#FF4D5E' }}>*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                  style={{ background: '#111', border: '1px solid #1f1f1f', color: '#fff' }}
                  rows={4}
                  placeholder="Describe your use case and why you need fiat-crypto trading access..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#8FA398' }}>
                  Expected monthly volume (optional)
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: '#111', border: '1px solid #1f1f1f', color: '#fff' }}
                  placeholder="e.g. $50,000 USD equivalent"
                  value={expectedVolume}
                  onChange={e => setExpectedVolume(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#8FA398' }}>
                  Contact info (optional)
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: '#111', border: '1px solid #1f1f1f', color: '#fff' }}
                  placeholder="Telegram / Email"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm" style={{ color: '#FF4D5E' }}>
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: '#1f1f1f', color: '#8FA398' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequest}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: submitting ? '#555' : 'linear-gradient(135deg, #00c9a7, #00a88a)',
                  color: '#000',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function checkCooldown(reviewedAt?: string): boolean {
  if (!reviewedAt) return true;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return new Date(reviewedAt) < sevenDaysAgo;
}
