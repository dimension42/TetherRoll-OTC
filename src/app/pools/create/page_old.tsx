'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { FIAT_CURRENCIES } from '@/lib/constants';
import Tilt from 'react-parallax-tilt';

type Step = 1 | 2 | 3;
type TradeMode = 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO';

const STEPS = [
  { num: 1, label: 'Trade Type' },
  { num: 2, label: 'Assets' },
  { num: 3, label: 'Confirm' },
];

const CHAINS = [
  { label: 'Ethereum', value: 'ETHEREUM' },
  { label: 'Polygon', value: 'POLYGON' },
  { label: 'BSC', value: 'BSC' },
  { label: 'Tron', value: 'TRON' },
];

const EXPIRY_OPTIONS = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '72h', hours: 72 },
];

export default function CreatePoolPage() {
  const { user, authenticated, ready, login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [tradeMode, setTradeMode] = useState<TradeMode>('CRYPTO_CRYPTO');
  const [offerSymbol, setOfferSymbol] = useState('');
  const [offerChain, setOfferChain] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [requestSymbol, setRequestSymbol] = useState('');
  const [requestChain, setRequestChain] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [fiatCurrency, setFiatCurrency] = useState('KRW');
  const [collateralEnabled, setCollateralEnabled] = useState(false);
  const [collateralPct, setCollateralPct] = useState(50);
  const [expiryHours, setExpiryHours] = useState(24);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (step < 3) setStep((step + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      // expiresAt 계산
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      const body = {
        tradeType: tradeMode,
        offerSymbol: tradeMode === 'FIAT_CRYPTO' ? requestSymbol : offerSymbol,
        offerChain: tradeMode === 'FIAT_CRYPTO' ? requestChain : offerChain,
        offerAmount: tradeMode === 'FIAT_CRYPTO' ? requestAmount : offerAmount,
        requestSymbol: tradeMode === 'CRYPTO_FIAT' ? requestSymbol : offerSymbol,
        requestChain: tradeMode === 'CRYPTO_FIAT' ? requestChain : offerChain,
        requestAmount: tradeMode === 'CRYPTO_FIAT' ? requestAmount : offerAmount,
        fiatCurrency: tradeMode !== 'CRYPTO_CRYPTO' ? fiatCurrency : undefined,
        collateralMode: collateralEnabled ? 'KRW_SIDE_LOCKS' : 'NONE',
        collateralPct: collateralEnabled ? collateralPct : undefined,
        expiresAt: expiresAt.toISOString(),
      };

      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to create pool: ${res.status}`);
      }

      const data = await res.json();
      router.push('/pools');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to create pool');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center grid-bg" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-5xl mb-4">🔗</p>
          <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="mb-6" style={{ color: '#666' }}>Please sign in to create a pool</p>
          <button className="btn-primary" onClick={login}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const isVip = user?.vipStatus === 'approved';

  return (
    <div className="min-h-screen pt-20 pb-16 grid-bg" style={{ background: '#080808' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white mb-2">Register Pool</h1>
          <p style={{ color: '#666' }}>Set your OTC trade terms</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-10">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                  style={{
                    background: step >= s.num
                      ? 'linear-gradient(135deg, #00c9a7, #00a88a)'
                      : 'rgba(255,255,255,0.05)',
                    color: step >= s.num ? '#000' : '#555',
                    border: step === s.num ? '2px solid #00c9a7' : '2px solid transparent',
                    boxShadow: step === s.num ? '0 0 16px rgba(0,201,167,0.4)' : 'none',
                  }}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <p className="text-xs mt-1 hidden sm:block" style={{ color: step === s.num ? '#00c9a7' : '#555' }}>
                  {s.label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 transition-all duration-500"
                  style={{ background: step > s.num ? '#00c9a7' : '#1f1f1f' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.2)' }}>
            <p className="text-sm" style={{ color: '#FF4D5E' }}>⚠️ {error}</p>
          </div>
        )}

        {/* Form card */}
        <Tilt tiltMaxAngleX={2} tiltMaxAngleY={2} glareEnable glareMaxOpacity={0.03} transitionSpeed={800}>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #00c9a7, #6366f1, #00ff88)' }} />
            <div className="p-8">
              <AnimatePresence mode="wait">
                {/* Step 1 - Trade type */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-xl font-bold text-white mb-6">Select Trade Type</h2>
                    <div className="grid gap-4">
                      <button
                        onClick={() => setTradeMode('CRYPTO_CRYPTO')}
                        className="p-4 rounded-xl text-left transition-all duration-200"
                        style={{
                          background: tradeMode === 'CRYPTO_CRYPTO' ? 'rgba(0,201,167,0.08)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${tradeMode === 'CRYPTO_CRYPTO' ? 'rgba(0,201,167,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                            style={{ background: tradeMode === 'CRYPTO_CRYPTO' ? 'rgba(0,201,167,0.2)' : 'rgba(255,255,255,0.05)', color: '#00c9a7' }}
                          >
                            ⟠↔⟠
                          </div>
                          <div>
                            <p className="font-bold text-white">Crypto ↔ Crypto</p>
                            <p className="text-sm" style={{ color: '#666' }}>Swap one crypto for another</p>
                          </div>
                          {tradeMode === 'CRYPTO_CRYPTO' && <span className="ml-auto text-lg">✓</span>}
                        </div>
                      </button>

                      {isVip && (
                        <>
                          <button
                            onClick={() => setTradeMode('CRYPTO_FIAT')}
                            className="p-4 rounded-xl text-left transition-all duration-200"
                            style={{
                              background: tradeMode === 'CRYPTO_FIAT' ? 'rgba(0,201,167,0.08)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${tradeMode === 'CRYPTO_FIAT' ? 'rgba(0,201,167,0.4)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                                style={{ background: tradeMode === 'CRYPTO_FIAT' ? 'rgba(0,201,167,0.2)' : 'rgba(255,255,255,0.05)', color: '#00c9a7' }}
                              >
                                ₿→$
                              </div>
                              <div>
                                <p className="font-bold text-white">Crypto → Fiat</p>
                                <p className="text-sm" style={{ color: '#666' }}>Sell crypto and receive cash</p>
                              </div>
                              {tradeMode === 'CRYPTO_FIAT' && <span className="ml-auto text-lg">✓</span>}
                            </div>
                          </button>

                          <button
                            onClick={() => setTradeMode('FIAT_CRYPTO')}
                            className="p-4 rounded-xl text-left transition-all duration-200"
                            style={{
                              background: tradeMode === 'FIAT_CRYPTO' ? 'rgba(0,201,167,0.08)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${tradeMode === 'FIAT_CRYPTO' ? 'rgba(0,201,167,0.4)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                                style={{ background: tradeMode === 'FIAT_CRYPTO' ? 'rgba(0,201,167,0.2)' : 'rgba(255,255,255,0.05)', color: '#00c9a7' }}
                              >
                                $→₿
                              </div>
                              <div>
                                <p className="font-bold text-white">Fiat → Crypto</p>
                                <p className="text-sm" style={{ color: '#666' }}>Pay cash and receive crypto</p>
                              </div>
                              {tradeMode === 'FIAT_CRYPTO' && <span className="ml-auto text-lg">✓</span>}
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 2 - Asset setup */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-xl font-bold text-white mb-6">Asset Configuration</h2>

                    {/* Offer asset */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2" style={{ color: '#00c9a7' }}>
                        Offer Asset
                      </label>
                      {tradeMode !== 'FIAT_CRYPTO' ? (
                        <div className="grid gap-3">
                          <input
                            className="input-dark"
                            placeholder="Symbol (e.g., USDT)"
                            value={offerSymbol}
                            onChange={e => setOfferSymbol(e.target.value.toUpperCase())}
                            maxLength={10}
                          />
                          <select className="input-dark" value={offerChain} onChange={e => setOfferChain(e.target.value)}>
                            <option value="">Select chain</option>
                            {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <input
                            className="input-dark"
                            placeholder="Enter amount"
                            value={offerAmount}
                            onChange={e => setOfferAmount(e.target.value)}
                            type="number"
                            min="0"
                            step="any"
                          />
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          <select className="input-dark" value={fiatCurrency} onChange={e => setFiatCurrency(e.target.value)}>
                            {FIAT_CURRENCIES.map(f => <option key={f.code} value={f.code}>{f.flag} {f.code}</option>)}
                          </select>
                          <input
                            className="input-dark"
                            placeholder="Enter amount"
                            value={offerAmount}
                            onChange={e => setOfferAmount(e.target.value)}
                            type="number"
                            min="0"
                            step="any"
                          />
                        </div>
                      )}
                    </div>

                    {/* Request asset */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2" style={{ color: '#00ff88' }}>
                        Request Asset
                      </label>
                      {tradeMode !== 'CRYPTO_FIAT' ? (
                        <div className="grid gap-3">
                          <input
                            className="input-dark"
                            placeholder="Symbol (e.g., USDC)"
                            value={requestSymbol}
                            onChange={e => setRequestSymbol(e.target.value.toUpperCase())}
                            maxLength={10}
                          />
                          <select className="input-dark" value={requestChain} onChange={e => setRequestChain(e.target.value)}>
                            <option value="">Select chain</option>
                            {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <input
                            className="input-dark"
                            placeholder="Enter amount"
                            value={requestAmount}
                            onChange={e => setRequestAmount(e.target.value)}
                            type="number"
                            min="0"
                            step="any"
                          />
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          <select className="input-dark" value={fiatCurrency} onChange={e => setFiatCurrency(e.target.value)}>
                            {FIAT_CURRENCIES.map(f => <option key={f.code} value={f.code}>{f.flag} {f.code}</option>)}
                          </select>
                          <input
                            className="input-dark"
                            placeholder="Enter amount"
                            value={requestAmount}
                            onChange={e => setRequestAmount(e.target.value)}
                            type="number"
                            min="0"
                            step="any"
                          />
                        </div>
                      )}
                    </div>

                    {/* Collateral (fiat only) */}
                    {tradeMode !== 'CRYPTO_CRYPTO' && (
                      <div className="mb-6">
                        <label className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            checked={collateralEnabled}
                            onChange={e => setCollateralEnabled(e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium text-white">Enable On-Chain Collateral</span>
                        </label>
                        {collateralEnabled && (
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm" style={{ color: '#888' }}>Collateral Percentage</span>
                              <span className="text-sm font-bold" style={{ color: '#00c9a7' }}>{collateralPct}%</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={collateralPct}
                              onChange={e => setCollateralPct(Number(e.target.value))}
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expiry */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#888' }}>Expiry Period</label>
                      <div className="flex gap-2">
                        {EXPIRY_OPTIONS.map(opt => (
                          <button
                            key={opt.hours}
                            onClick={() => setExpiryHours(opt.hours)}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: expiryHours === opt.hours ? 'rgba(0,201,167,0.15)' : 'rgba(255,255,255,0.04)',
                              color: expiryHours === opt.hours ? '#00c9a7' : '#666',
                              border: `1px solid ${expiryHours === opt.hours ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3 - Confirm */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-xl font-bold text-white mb-6">Confirm Registration</h2>

                    <div className="space-y-3 mb-8">
                      {[
                        { label: 'Trade Type', value: tradeMode === 'CRYPTO_FIAT' ? 'Crypto → Fiat' : tradeMode === 'FIAT_CRYPTO' ? 'Fiat → Crypto' : 'Crypto ↔ Crypto' },
                        { label: 'Offer', value: tradeMode === 'FIAT_CRYPTO' ? `${offerAmount || '-'} ${fiatCurrency}` : `${offerAmount || '-'} ${offerSymbol}` },
                        { label: 'Request', value: tradeMode === 'CRYPTO_FIAT' ? `${requestAmount || '-'} ${fiatCurrency}` : `${requestAmount || '-'} ${requestSymbol}` },
                        { label: 'Collateral', value: collateralEnabled ? `${collateralPct}%` : 'None' },
                        { label: 'Expiry', value: `${expiryHours}h` },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center py-3 px-4 rounded-lg" style={{ background: '#0d0d0d' }}>
                          <span className="text-sm" style={{ color: '#666' }}>{item.label}</span>
                          <span className="text-sm font-semibold text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <p className="text-sm" style={{ color: '#888' }}>
                        🔗 Your pool will be created on-chain in Phase 3 (EscrowVault deployment).
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex gap-3 mt-8">
                {step > 1 && (
                  <button className="btn-secondary flex-1" onClick={handleBack}>← Back</button>
                )}
                {step < 3 ? (
                  <button className="btn-primary flex-1 justify-center" onClick={handleNext}>Next →</button>
                ) : (
                  <button
                    className="btn-primary flex-1 justify-center"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Processing...
                      </span>
                    ) : '🚀 Register Pool'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Tilt>
      </div>
    </div>
  );
}
