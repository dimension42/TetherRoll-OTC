'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Fill {
  id: string;
  venue_id: string;
  amount_krw: string;
  amount_asset: string;
  rate: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
}

interface Order {
  id: string;
  side: string;
  asset: string;
  chain: string;
  amount_krw: string;
  status: string;
  filled_krw: string;
  filled_asset: string;
  min_fill_pct: number;
  deposit_code: string;
  receive_address: string;
  refund_krw: string;
  discount_applied: string;
  created_at: string;
  expires_at: string;
}

export default function RollOrderDetailClient({ orderId }: { orderId: string }) {
  const [data, setData] = useState<{ order: Order; fills: Fill[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch(`/api/roll/orders/${orderId}`)
        .then(r => r.json())
        .then(d => {
          setData(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    load();

    // Poll every 10s if active
    const interval = setInterval(() => {
      if (data?.order.status === 'FILLING' || data?.order.status === 'AWAITING_DEPOSIT') {
        load();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [orderId, data?.order.status]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050806' }}>
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const { order, fills } = data;
  const fillPct = parseFloat(order.filled_krw) / parseFloat(order.amount_krw) * 100;

  const statusColors: Record<string, string> = {
    AWAITING_DEPOSIT: '#FFB020',
    FILLING: '#00c9a7',
    FILLED: '#00ff88',
    PART_SETTLED: '#a78bfa',
    REFUNDED: '#8FA398',
    FROZEN: '#FF4D5E',
    CANCELLED: '#666',
  };

  const explorerUrl = (hash: string) => {
    if (order.chain === 'TRC20') return `https://tronscan.org/#/transaction/${hash}`;
    return `https://etherscan.io/tx/${hash}`;
  };

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-white">
              {order.side} {order.asset}
            </h1>
            <span
              className="px-3 py-1 rounded-lg text-sm font-bold"
              style={{
                background: `${statusColors[order.status]}22`,
                color: statusColors[order.status],
              }}
            >
              {order.status}
            </span>
          </div>
          <p style={{ color: '#8FA398' }}>{order.chain}</p>
        </div>

        {order.status === 'FILLING' && (
          <div className="mb-6 p-6 rounded-xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ color: '#8FA398' }}>Fill Progress</span>
              <span className="font-black" style={{ color: '#00c9a7' }}>{fillPct.toFixed(1)}%</span>
            </div>
            <div className="relative h-4 rounded-full overflow-hidden" style={{ background: '#111' }}>
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: 'linear-gradient(90deg, #00c9a7, #00ff88)' }}
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={{ duration: 0.5 }}
              />
              {/* Min fill line */}
              <div
                className="absolute inset-y-0 w-px"
                style={{ left: `${order.min_fill_pct}%`, background: '#FFB020' }}
                title={`Min fill ${order.min_fill_pct}%`}
              />
            </div>
          </div>
        )}

        {fills.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Fills</h3>
            <div className="space-y-3">
              {fills.map(fill => (
                <div
                  key={fill.id}
                  className="p-4 rounded-xl"
                  style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">{fill.venue_id}</span>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{
                        background: fill.status === 'SENT' ? 'rgba(0,255,136,0.1)' : 'rgba(0,201,167,0.1)',
                        color: fill.status === 'SENT' ? '#00ff88' : '#00c9a7',
                      }}
                    >
                      {fill.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: '#8FA398' }}>
                      {parseFloat(fill.amount_asset).toLocaleString()} {order.asset}
                    </span>
                    <span className="font-mono" style={{ color: '#8FA398' }}>
                      ₩{parseFloat(fill.amount_krw).toLocaleString()}
                    </span>
                  </div>
                  {fill.tx_hash && (
                    <a
                      href={explorerUrl(fill.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs mt-2 inline-block"
                      style={{ color: '#00c9a7' }}
                    >
                      Tx: {fill.tx_hash.slice(0, 10)}...{fill.tx_hash.slice(-8)}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(order.status === 'FILLED' || order.status === 'PART_SETTLED' || order.status === 'REFUNDED') && (
          <div className="p-6 rounded-xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
            <h3 className="text-xl font-bold text-white mb-4">Settlement</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span style={{ color: '#8FA398' }}>Filled</span>
                <span className="font-mono text-white">₩{parseFloat(order.filled_krw).toLocaleString()}</span>
              </div>
              {order.discount_applied && parseFloat(order.discount_applied) > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: '#00c9a7' }}>Fee Discount (90%)</span>
                  <span className="font-mono" style={{ color: '#00c9a7' }}>
                    −₩{parseFloat(order.discount_applied).toLocaleString()}
                  </span>
                </div>
              )}
              {order.refund_krw && parseFloat(order.refund_krw) > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: '#8FA398' }}>Refund</span>
                  <span className="font-mono text-white">₩{parseFloat(order.refund_krw).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
