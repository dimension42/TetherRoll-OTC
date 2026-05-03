'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { SUPPORTED_TOKENS, FIAT_CURRENCIES } from '@/lib/constants';
import Tilt from 'react-parallax-tilt';

type Step = 1 | 2 | 3 | 4;
type TradeMode = 'CRYPTO_CRYPTO' | 'CRYPTO_FIAT' | 'FIAT_CRYPTO';

const STEPS = [
  { num: 1, label: '거래 유형' },
  { num: 2, label: '자산 설정' },
  { num: 3, label: '보증금' },
  { num: 4, label: '확인 & 등록' },
];

export default function CreatePoolPage() {
  const { address, isConnected, chainId } = useAccount();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [tradeMode, setTradeMode] = useState<TradeMode>('CRYPTO_FIAT');
  const [offerToken, setOfferToken] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [requestToken, setRequestToken] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [fiatCurrency, setFiatCurrency] = useState('KRW');
  const [fiatAmount, setFiatAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [expiryDays, setExpiryDays] = useState('3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tokens = SUPPORTED_TOKENS[chainId || 11155111] || SUPPORTED_TOKENS[11155111];

  const handleNext = () => {
    if (step < 4) setStep((step + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsSubmitting(false);
    alert('Pool 등록 완료! (컨트랙트 배포 후 실제 트랜잭션 발생)');
    router.push('/pools');
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center grid-bg" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <p className="text-5xl mb-4">🔗</p>
          <h2 className="text-2xl font-bold text-white mb-2">지갑 연결 필요</h2>
          <p className="mb-6" style={{ color: '#666' }}>Pool 등록을 위해 지갑을 연결해주세요</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16 grid-bg" style={{ background: '#080808' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white mb-2">Pool 등록</h1>
          <p style={{ color: '#666' }}>OTC 거래 조건을 설정하고 보증금을 납입합니다</p>
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
                      ? 'linear-gradient(135deg, #f0b429, #c9922a)'
                      : 'rgba(255,255,255,0.05)',
                    color: step >= s.num ? '#000' : '#555',
                    border: step === s.num ? '2px solid #f0b429' : '2px solid transparent',
                    boxShadow: step === s.num ? '0 0 16px rgba(240,180,41,0.4)' : 'none',
                  }}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <p className="text-xs mt-1 hidden sm:block" style={{ color: step === s.num ? '#f0b429' : '#555' }}>
                  {s.label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 transition-all duration-500"
                  style={{ background: step > s.num ? '#f0b429' : '#1f1f1f' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <Tilt tiltMaxAngleX={2} tiltMaxAngleY={2} glareEnable glareMaxOpacity={0.03} transitionSpeed={800}>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #f0b429, #6366f1, #00ff88)' }} />
            <div className="p-8">
              <AnimatePresence mode="wait">
                {/* Step 1 - Trade type */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-xl font-bold text-white mb-6">거래 유형 선택</h2>
                    <div className="grid gap-4">
                      {([
                        { value: 'CRYPTO_FIAT', title: 'Crypto → Fiat', desc: '코인을 팔고 현금을 받습니다', icon: '₿→₩' },
                        { value: 'FIAT_CRYPTO', title: 'Fiat → Crypto', desc: '현금을 내고 코인을 삽니다', icon: '₩→₿' },
                        { value: 'CRYPTO_CRYPTO', title: 'Crypto ↔ Crypto', desc: '코인과 코인을 교환합니다', icon: '⟠↔⟠' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setTradeMode(opt.value)}
                          className="p-4 rounded-xl text-left transition-all duration-200"
                          style={{
                            background: tradeMode === opt.value ? 'rgba(240,180,41,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${tradeMode === opt.value ? 'rgba(240,180,41,0.4)' : 'rgba(255,255,255,0.07)'}`,
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                              style={{ background: tradeMode === opt.value ? 'rgba(240,180,41,0.2)' : 'rgba(255,255,255,0.05)', color: '#f0b429' }}
                            >
                              {opt.icon}
                            </div>
                            <div>
                              <p className="font-bold text-white">{opt.title}</p>
                              <p className="text-sm" style={{ color: '#666' }}>{opt.desc}</p>
                            </div>
                            {tradeMode === opt.value && <span className="ml-auto text-lg">✓</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2 - Asset setup */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-xl font-bold text-white mb-6">자산 설정</h2>

                    {/* Offer asset */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2" style={{ color: '#f0b429' }}>
                        제공할 자산 (Offer)
                      </label>
                      {tradeMode !== 'FIAT_CRYPTO' ? (
                        <div className="flex gap-3">
                          <select className="input-dark w-32 shrink-0" value={offerToken} onChange={e => setOfferToken(e.target.value)}>
                            <option value="">토큰 선택</option>
                            {tokens.map(t => <option key={t.address} value={t.address}>{t.icon} {t.symbol}</option>)}
                          </select>
                          <input className="input-dark" placeholder="수량 입력" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} type="number" min="0" />
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <select className="input-dark w-32 shrink-0" value={fiatCurrency} onChange={e => setFiatCurrency(e.target.value)}>
                            {FIAT_CURRENCIES.map(f => <option key={f.code} value={f.code}>{f.flag} {f.code}</option>)}
                          </select>
                          <input className="input-dark" placeholder="금액 입력" value={fiatAmount} onChange={e => setFiatAmount(e.target.value)} type="number" min="0" />
                        </div>
                      )}
                    </div>

                    {/* Request asset */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2" style={{ color: '#00ff88' }}>
                        요청할 자산 (Request)
                      </label>
                      {tradeMode !== 'CRYPTO_FIAT' ? (
                        <div className="flex gap-3">
                          <select className="input-dark w-32 shrink-0" value={requestToken} onChange={e => setRequestToken(e.target.value)}>
                            <option value="">토큰 선택</option>
                            {tokens.map(t => <option key={t.address} value={t.address}>{t.icon} {t.symbol}</option>)}
                          </select>
                          <input className="input-dark" placeholder="수량 입력" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} type="number" min="0" />
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <select className="input-dark w-32 shrink-0" value={fiatCurrency} onChange={e => setFiatCurrency(e.target.value)}>
                            {FIAT_CURRENCIES.map(f => <option key={f.code} value={f.code}>{f.flag} {f.code}</option>)}
                          </select>
                          <input className="input-dark" placeholder="금액 입력" value={fiatAmount} onChange={e => setFiatAmount(e.target.value)} type="number" min="0" />
                        </div>
                      )}
                    </div>

                    {/* Expiry */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#888' }}>만료 기간</label>
                      <div className="flex gap-2">
                        {['1', '3', '7', '14', '30'].map(d => (
                          <button
                            key={d}
                            onClick={() => setExpiryDays(d)}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: expiryDays === d ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.04)',
                              color: expiryDays === d ? '#f0b429' : '#666',
                              border: `1px solid ${expiryDays === d ? 'rgba(240,180,41,0.3)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            {d}일
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3 - Deposit */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-xl font-bold text-white mb-2">보증금 설정</h2>
                    <p className="text-sm mb-6" style={{ color: '#666' }}>
                      보증금은 거래 이행 보장을 위해 에스크로에 잠금됩니다. 거래 완료 후 전액 환불됩니다.
                    </p>

                    <div
                      className="p-4 rounded-xl mb-6"
                      style={{ background: 'rgba(240,180,41,0.05)', border: '1px solid rgba(240,180,41,0.15)' }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: '#f0b429' }}>⚠️ 보증금 역할</p>
                      <p className="text-sm" style={{ color: '#888' }}>
                        상대방이 현장에 나타나지 않거나 거래를 파기할 경우, 보증금이 패널티로 귀하에게 지급됩니다.
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-white">보증금 금액</label>
                      <div className="flex gap-3">
                        <input
                          className="input-dark"
                          placeholder="0.0"
                          value={depositAmount}
                          onChange={e => setDepositAmount(e.target.value)}
                          type="number"
                          min="0"
                        />
                        <div className="px-4 py-3 rounded-lg shrink-0 text-sm font-medium" style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#888' }}>
                          {tradeMode !== 'FIAT_CRYPTO' ? tokens.find(t => t.address === offerToken)?.symbol || 'ETH' : fiatCurrency}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {['5', '10', '20'].map(pct => (
                        <button
                          key={pct}
                          className="py-2 rounded-lg text-sm font-medium transition-all"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            color: '#888',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                          onClick={() => {
                            const base = Number(offerAmount) || 1;
                            setDepositAmount((base * Number(pct) / 100).toFixed(4));
                          }}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 4 - Confirm */}
                {step === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-xl font-bold text-white mb-6">등록 확인</h2>

                    <div className="space-y-3 mb-8">
                      {[
                        { label: '거래 유형', value: tradeMode === 'CRYPTO_FIAT' ? 'Crypto → Fiat' : tradeMode === 'FIAT_CRYPTO' ? 'Fiat → Crypto' : 'Crypto ↔ Crypto' },
                        { label: '제공 자산', value: `${offerAmount || '-'} ${tokens.find(t => t.address === offerToken)?.symbol || ''}` },
                        { label: '요청 자산', value: tradeMode === 'CRYPTO_CRYPTO' ? `${requestAmount || '-'} ${tokens.find(t => t.address === requestToken)?.symbol || ''}` : `${Number(fiatAmount).toLocaleString()} ${fiatCurrency}` },
                        { label: '보증금', value: `${depositAmount || '-'} ${tokens.find(t => t.address === offerToken)?.symbol || ''}` },
                        { label: '만료 기간', value: `${expiryDays}일` },
                        { label: '등록 지갑', value: address ? address.slice(0, 10) + '...' + address.slice(-8) : '-' },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center py-3 px-4 rounded-lg" style={{ background: '#0d0d0d' }}>
                          <span className="text-sm" style={{ color: '#666' }}>{item.label}</span>
                          <span className="text-sm font-semibold text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <p className="text-sm" style={{ color: '#888' }}>
                        🔗 등록 시 보증금이 스마트 컨트랙트로 전송됩니다. 가스비가 발생합니다.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex gap-3 mt-8">
                {step > 1 && (
                  <button className="btn-secondary flex-1" onClick={handleBack}>← 이전</button>
                )}
                {step < 4 ? (
                  <button className="btn-primary flex-1 justify-center" onClick={handleNext}>다음 →</button>
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
                        트랜잭션 처리 중...
                      </span>
                    ) : '🚀 Pool 등록하기'}
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
