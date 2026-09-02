'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Order {
  id: string;
  side: string;
  asset: string;
  chain: string;
  amount_krw: string;
  status: string;
  created_at: string;
  filled_krw: string;
}

export default function RollOrdersListClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/roll/orders')
      .then(r => r.json())
      .then(data => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    AWAITING_DEPOSIT: '#FFB020',
    FILLING: '#00c9a7',
    FILLED: '#00ff88',
    PART_SETTLED: '#a78bfa',
    REFUNDED: '#8FA398',
    FROZEN: '#FF4D5E',
    CANCELLED: '#666',
    EXPIRED: '#666',
  };

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-white">My Roll Orders</h1>
          <Link
            href="/vip/roll/new"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)', color: '#000' }}
          >
            + New Order
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
            />
          </div>
        ) : orders.length === 0 ? (
          <div
            className="p-12 rounded-2xl text-center"
            style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
          >
            <p className="text-4xl mb-3">🎲</p>
            <p className="text-white font-semibold mb-2">No orders yet</p>
            <p className="text-sm mb-4" style={{ color: '#8FA398' }}>
              Create your first Roll Order
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <Link
                key={order.id}
                href={`/vip/roll/${order.id}`}
                className="block p-6 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-bold">
                        {order.side} {order.asset}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: `${statusColors[order.status]}22`,
                          color: statusColors[order.status],
                        }}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: '#8FA398' }}>
                      {order.chain} · {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xl font-black"
                      style={{ color: '#00c9a7', fontVariantNumeric: 'tabular-nums' }}
                    >
                      ₩{parseFloat(order.amount_krw).toLocaleString()}
                    </p>
                    {order.filled_krw && parseFloat(order.filled_krw) > 0 && (
                      <p className="text-xs mt-1" style={{ color: '#8FA398' }}>
                        Filled: ₩{parseFloat(order.filled_krw).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
