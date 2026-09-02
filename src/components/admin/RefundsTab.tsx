'use client';

import { useState, useEffect } from 'react';

interface Refund {
  id: string;
  roll_order_id: string;
  amount_krw: string;
  status: string;
  note: string | null;
  created_at: string;
  roll_orders: {
    users: { email: string | null; wallet_address: string | null; display_name: string | null };
  };
}

export default function RefundsTab() {
  const [status, setStatus] = useState('REQUESTED');
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealedBank, setRevealedBank] = useState<{ id: string; info: { bank: string; account: string; holder: string }; timer: number } | null>(null);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/refunds?status=${status}`);
      const data = await res.json();
      setRefunds(data.refunds || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (revealedBank && revealedBank.timer > 0) {
      const interval = setInterval(() => {
        setRevealedBank(prev => (prev ? { ...prev, timer: prev.timer - 1 } : null));
      }, 1000);
      return () => clearInterval(interval);
    } else if (revealedBank && revealedBank.timer === 0) {
      setRevealedBank(null);
    }
  }, [revealedBank]);

  const handleRevealBank = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/refunds/${id}/bank`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRevealedBank({ id, info: data.bankInfo, timer: 60 });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'PROCESSING' | 'DONE' | 'FAILED', note?: string) => {
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, note }),
      });
      if (!res.ok) throw new Error('Failed');
      loadRefunds();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Refunds</h2>

      <div className="flex gap-2 mb-6">
        {(['REQUESTED', 'PROCESSING', 'DONE', 'FAILED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: status === s ? 'rgba(0,201,167,0.15)' : '#111',
              color: status === s ? '#00c9a7' : '#8FA398',
              border: `1px solid ${status === s ? '#00c9a7' : '#1f1f1f'}`,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && refunds.length === 0 && (
        <div className="text-center py-12">
          <p style={{ color: '#8FA398' }}>No {status} refunds</p>
        </div>
      )}

      {!loading && refunds.length > 0 && (
        <div className="space-y-4">
          {refunds.map(refund => {
            const user = refund.roll_orders.users;
            const bankRevealed = revealedBank?.id === refund.id;
            return (
              <div key={refund.id} className="p-4 rounded-xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-bold">
                      {user.email || user.display_name || user.wallet_address?.slice(0, 10)}
                    </p>
                    <p className="text-xs" style={{ color: '#8FA398' }}>
                      Order: {refund.roll_order_id.slice(0, 8)}...
                    </p>
                  </div>
                  <p className="text-white font-mono">₩{parseFloat(refund.amount_krw).toLocaleString()}</p>
                </div>

                {refund.note && (
                  <p className="text-xs mb-2" style={{ color: '#8FA398' }}>Note: {refund.note}</p>
                )}

                {bankRevealed && (
                  <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,176,32,0.1)', border: '1px solid rgba(255,176,32,0.3)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: '#FFB020' }}>Bank Info (closes in {revealedBank.timer}s)</p>
                    <p className="text-sm text-white">Bank: {revealedBank.info.bank}</p>
                    <p className="text-sm text-white">Account: {revealedBank.info.account}</p>
                    <p className="text-sm text-white">Holder: {revealedBank.info.holder}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {status === 'REQUESTED' && (
                    <>
                      <button
                        onClick={() => handleRevealBank(refund.id)}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: 'rgba(255,176,32,0.15)', color: '#FFB020' }}
                      >
                        Reveal Bank
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(refund.id, 'PROCESSING')}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                      >
                        Start Processing
                      </button>
                    </>
                  )}
                  {status === 'PROCESSING' && (
                    <>
                      <button
                        onClick={() => {
                          const note = prompt('Note (optional):');
                          handleUpdateStatus(refund.id, 'DONE', note || undefined);
                        }}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: 'rgba(0,255,136,0.15)', color: '#00ff88' }}
                      >
                        Mark Done
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Failure reason:');
                          if (note) handleUpdateStatus(refund.id, 'FAILED', note);
                        }}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: 'rgba(255,77,94,0.15)', color: '#FF4D5E' }}
                      >
                        Mark Failed
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
