'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLL_CHAINS } from '@/lib/tokens';

type Step = 'params' | 'quote';

interface QuoteResult {
  quoteId: string;
  venues: Array<{ id: string; name: string; share: number; rate: number }>;
  coveragePct: number;
  execCost: number;
  feePlatform: number;
  feeGas: number;
  total: number;
  expiresAt: string;
}

export default function RollOrderWizardClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('params');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [asset, setAsset] = useState<'USDT' | 'USDC'>('USDT');
  const [chain, setChain] = useState(ROLL_CHAINS[0].key);
  const [amountKrw, setAmountKrw] = useState('');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [minFillPct, setMinFillPct] = useState(80);
  const [expiresIn, setExpiresIn] = useState<'1h' | '6h' | '24h'>('24h');
  const [receiveAddress, setReceiveAddress] = useState('');

  const handleQuote = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/roll/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, asset, chain, amountKrw: parseFloat(amountKrw) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quote failed');
      setQuote(data);
      setStep('quote');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!quote) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/roll/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.quoteId, receiveAddress, minFillPct, expiresIn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order creation failed');
      router.push(`/vip/roll/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black text-white mb-8">New Roll Order</h1>

        {error && (
          <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.3)' }}>
            <p style={{ color: '#FF4D5E' }}>{error}</p>
          </div>
        )}

        {step === 'params' && (
          <div className="p-6 rounded-xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-2">Direction</label>
              <div className="flex gap-3">
                {(['BUY', 'SELL'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className="flex-1 py-3 rounded-xl font-semibold"
                    style={{
                      background: side === s ? 'rgba(0,201,167,0.15)' : '#111',
                      color: side === s ? '#00c9a7' : '#8FA398',
                      border: `1px solid ${side === s ? '#00c9a7' : '#1f1f1f'}`,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-2">Asset</label>
              <div className="flex gap-3">
                {(['USDT', 'USDC'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => setAsset(a)}
                    className="flex-1 py-3 rounded-xl font-semibold"
                    style={{
                      background: asset === a ? 'rgba(0,201,167,0.15)' : '#111',
                      color: asset === a ? '#00c9a7' : '#8FA398',
                      border: `1px solid ${asset === a ? '#00c9a7' : '#1f1f1f'}`,
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-2">Chain</label>
              <select
                value={chain}
                onChange={e => setChain(e.target.value as typeof ROLL_CHAINS[number]['key'])}
                className="w-full px-4 py-3 rounded-xl text-white"
                style={{ background: '#111', border: '1px solid #1f1f1f' }}
              >
                {ROLL_CHAINS.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-2">Amount (KRW)</label>
              <input
                type="number"
                value={amountKrw}
                onChange={e => setAmountKrw(e.target.value)}
                placeholder="500000000"
                className="w-full px-4 py-3 rounded-xl text-white"
                style={{ background: '#111', border: '1px solid #1f1f1f' }}
              />
            </div>

            <button
              onClick={handleQuote}
              disabled={loading || !amountKrw}
              className="w-full py-3 rounded-xl font-semibold"
              style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)', color: '#000' }}
            >
              {loading ? 'Getting Quote...' : 'Get Quote'}
            </button>
          </div>
        )}

        {step === 'quote' && quote && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
              <h3 className="text-xl font-bold text-white mb-4">Quote Summary</h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span style={{ color: '#8FA398' }}>Execution Cost</span>
                  <span className="text-white font-mono">₩{quote.execCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#8FA398' }}>Platform Fee</span>
                  <span className="text-white font-mono">₩{quote.feePlatform.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#8FA398' }}>Gas Fee</span>
                  <span className="text-white font-mono">₩{quote.feeGas.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: '#1f1f1f' }}>
                  <span className="font-semibold" style={{ color: '#00c9a7' }}>Total</span>
                  <span className="text-xl font-black" style={{ color: '#00c9a7' }}>
                    ₩{quote.total.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-2">Min Fill %</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minFillPct}
                  onChange={e => setMinFillPct(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm mt-1" style={{ color: '#8FA398' }}>{minFillPct}%</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-2">Receive Address</label>
                <input
                  type="text"
                  value={receiveAddress}
                  onChange={e => setReceiveAddress(e.target.value)}
                  placeholder={chain === 'TRC20' ? 'T...' : '0x...'}
                  className="w-full px-4 py-3 rounded-xl text-white"
                  style={{ background: '#111', border: '1px solid #1f1f1f' }}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-2">Validity</label>
                <select
                  value={expiresIn}
                  onChange={e => setExpiresIn(e.target.value as '1h' | '6h' | '24h')}
                  className="w-full px-4 py-3 rounded-xl text-white"
                  style={{ background: '#111', border: '1px solid #1f1f1f' }}
                >
                  <option value="1h">1 hour</option>
                  <option value="6h">6 hours</option>
                  <option value="24h">24 hours</option>
                </select>
              </div>

              <button
                onClick={handleCreateOrder}
                disabled={loading || !receiveAddress}
                className="w-full py-3 rounded-xl font-semibold"
                style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)', color: '#000' }}
              >
                {loading ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
