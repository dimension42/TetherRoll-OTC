'use client';

import { useState, useEffect } from 'react';

interface Order {
  id: string;
  user_id: string;
  side: string;
  asset: string;
  chain: string;
  amount_krw: string;
  status: string;
  filled_krw: string;
  deposit_code: string;
  created_at: string;
  users: { email: string | null; wallet_address: string | null; display_name: string | null };
}

export default function RollsTab() {
  const [status, setStatus] = useState('FILLING');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmForm, setConfirmForm] = useState({ amountKrw: '', depositorName: '' });
  const [fillForm, setFillForm] = useState({ venueId: '', amountKrw: '', amountAsset: '', rate: '' });
  const [freezeReason, setFreezeReason] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rolls?status=${status}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleDepositConfirm = async (id: string) => {
    if (!confirmForm.amountKrw || !confirmForm.depositorName) return;
    try {
      const res = await fetch(`/api/admin/rolls/${id}/deposit-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountKrw: parseFloat(confirmForm.amountKrw), depositorName: confirmForm.depositorName }),
      });
      if (!res.ok) throw new Error('Failed');
      setConfirmForm({ amountKrw: '', depositorName: '' });
      setSelectedId(null);
      loadOrders();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleAddFill = async (id: string) => {
    if (!fillForm.venueId || !fillForm.amountKrw || !fillForm.amountAsset || !fillForm.rate) return;
    try {
      const res = await fetch(`/api/admin/rolls/${id}/fills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: fillForm.venueId,
          amountKrw: parseFloat(fillForm.amountKrw),
          amountAsset: parseFloat(fillForm.amountAsset),
          rate: parseFloat(fillForm.rate),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setFillForm({ venueId: '', amountKrw: '', amountAsset: '', rate: '' });
      loadOrders();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleSettle = async (id: string) => {
    if (!confirm('Settle this order?')) return;
    try {
      const res = await fetch(`/api/admin/rolls/${id}/settle`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      loadOrders();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleFreeze = async (id: string) => {
    if (!freezeReason.trim()) return;
    try {
      const res = await fetch(`/api/admin/rolls/${id}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: freezeReason }),
      });
      if (!res.ok) throw new Error('Failed');
      setFreezeReason('');
      setSelectedId(null);
      loadOrders();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const statusOpts = ['AWAITING_DEPOSIT', 'FILLING', 'FILLED', 'PART_SETTLED', 'FROZEN', 'REFUNDED'];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Roll Orders</h2>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {statusOpts.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
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

      {!loading && orders.length === 0 && (
        <div className="text-center py-12">
          <p style={{ color: '#8FA398' }}>No {status} orders</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="p-4 rounded-xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-bold">
                    {order.side} {order.asset} ({order.chain})
                  </p>
                  <p className="text-sm" style={{ color: '#8FA398' }}>
                    {order.users.email || order.users.display_name || order.users.wallet_address?.slice(0, 10)}
                  </p>
                  {order.deposit_code && (
                    <p className="text-xs mt-1" style={{ color: '#FFB020' }}>Code: {order.deposit_code}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-white font-mono">₩{parseFloat(order.amount_krw).toLocaleString()}</p>
                  {order.filled_krw && parseFloat(order.filled_krw) > 0 && (
                    <p className="text-xs" style={{ color: '#00c9a7' }}>
                      Filled: ₩{parseFloat(order.filled_krw).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {order.status === 'AWAITING_DEPOSIT' && selectedId === order.id && (
                <div className="mt-4 p-3 rounded-lg" style={{ background: '#111' }}>
                  <p className="text-sm font-medium text-white mb-2">Confirm Deposit</p>
                  <input
                    type="number"
                    placeholder="Amount KRW"
                    value={confirmForm.amountKrw}
                    onChange={e => setConfirmForm({ ...confirmForm, amountKrw: e.target.value })}
                    className="w-full px-3 py-2 mb-2 rounded text-white text-sm"
                    style={{ background: '#1f1f1f', border: '1px solid #333' }}
                  />
                  <input
                    type="text"
                    placeholder="Depositor Name"
                    value={confirmForm.depositorName}
                    onChange={e => setConfirmForm({ ...confirmForm, depositorName: e.target.value })}
                    className="w-full px-3 py-2 mb-2 rounded text-white text-sm"
                    style={{ background: '#1f1f1f', border: '1px solid #333' }}
                  />
                  <button
                    onClick={() => handleDepositConfirm(order.id)}
                    className="px-4 py-2 rounded text-sm font-semibold"
                    style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                  >
                    Confirm
                  </button>
                </div>
              )}

              {order.status === 'FILLING' && selectedId === order.id && (
                <div className="mt-4 p-3 rounded-lg" style={{ background: '#111' }}>
                  <p className="text-sm font-medium text-white mb-2">Add Fill</p>
                  <input
                    type="text"
                    placeholder="Venue ID"
                    value={fillForm.venueId}
                    onChange={e => setFillForm({ ...fillForm, venueId: e.target.value })}
                    className="w-full px-3 py-2 mb-2 rounded text-white text-sm"
                    style={{ background: '#1f1f1f', border: '1px solid #333' }}
                  />
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="number"
                      placeholder="KRW"
                      value={fillForm.amountKrw}
                      onChange={e => setFillForm({ ...fillForm, amountKrw: e.target.value })}
                      className="px-3 py-2 rounded text-white text-sm"
                      style={{ background: '#1f1f1f', border: '1px solid #333' }}
                    />
                    <input
                      type="number"
                      placeholder="Asset"
                      value={fillForm.amountAsset}
                      onChange={e => setFillForm({ ...fillForm, amountAsset: e.target.value })}
                      className="px-3 py-2 rounded text-white text-sm"
                      style={{ background: '#1f1f1f', border: '1px solid #333' }}
                    />
                    <input
                      type="number"
                      placeholder="Rate"
                      value={fillForm.rate}
                      onChange={e => setFillForm({ ...fillForm, rate: e.target.value })}
                      className="px-3 py-2 rounded text-white text-sm"
                      style={{ background: '#1f1f1f', border: '1px solid #333' }}
                    />
                  </div>
                  <button
                    onClick={() => handleAddFill(order.id)}
                    className="px-4 py-2 rounded text-sm font-semibold mr-2"
                    style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                  >
                    Add Fill
                  </button>
                  <button
                    onClick={() => handleSettle(order.id)}
                    className="px-4 py-2 rounded text-sm font-semibold"
                    style={{ background: 'rgba(0,255,136,0.15)', color: '#00ff88' }}
                  >
                    Settle
                  </button>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                {order.status === 'AWAITING_DEPOSIT' && (
                  <button
                    onClick={() => setSelectedId(selectedId === order.id ? null : order.id)}
                    className="px-3 py-1 rounded text-xs font-semibold"
                    style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                  >
                    {selectedId === order.id ? 'Hide' : 'Confirm Deposit'}
                  </button>
                )}
                {order.status === 'FILLING' && (
                  <>
                    <button
                      onClick={() => setSelectedId(selectedId === order.id ? null : order.id)}
                      className="px-3 py-1 rounded text-xs font-semibold"
                      style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                    >
                      {selectedId === order.id ? 'Hide' : 'Manage'}
                    </button>
                    <button
                      onClick={() => {
                        const r = prompt('Freeze reason:');
                        if (r) {
                          setFreezeReason(r);
                          handleFreeze(order.id);
                        }
                      }}
                      className="px-3 py-1 rounded text-xs font-semibold"
                      style={{ background: 'rgba(255,77,94,0.15)', color: '#FF4D5E' }}
                    >
                      Freeze
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
