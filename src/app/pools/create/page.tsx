'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSwitchChain } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useEscrowWrite } from '@/hooks/useEscrowVault';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useTxTracker } from '@/hooks/useTxTracker';
import { ChainSelect } from '@/components/ui/ChainSelect';
import { TokenSelect } from '@/components/ui/TokenSelect';
import { AmountInput } from '@/components/ui/AmountInput';
import { TxStepper } from '@/components/ui/TxStepper';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { escrowVaultAddress, isChainDeployed } from '@/lib/contracts/addresses';
import { isNative, type TokenInfo } from '@/lib/tokens';
import { type Chain } from 'viem/chains';

type Step = 1 | 2 | 3 | 4 | 5;
type Market = 'public' | 'vip';

const EXPIRY_OPTIONS = [
  { label: '1h', seconds: 3600 },
  { label: '6h', seconds: 21600 },
  { label: '24h', seconds: 86400 },
  { label: '72h', seconds: 259200 },
  { label: '7d', seconds: 604800 },
] as const;

export default function CreatePoolPage() {
  const router = useRouter();
  const { user, authenticated, ready, login } = useAuth();
  const { address: userAddress, chain: connectedChain } = useAccount();
  const { switchChain } = useSwitchChain();

  const [step, setStep] = useState<Step>(1);
  const [market, setMarket] = useState<Market>('public');
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [offerToken, setOfferToken] = useState<TokenInfo | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [requestToken, setRequestToken] = useState<TokenInfo | null>(null);
  const [requestAmount, setRequestAmount] = useState('');
  const [expirySeconds, setExpirySeconds] = useState(86400);
  const [allowPartial, setAllowPartial] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [txSteps, setTxSteps] = useState<Array<{ label: string; status: 'pending' | 'active' | 'success' | 'error'; txHash?: string; chainId?: number; error?: string }>>([]);

  const { write: escrowWrite, hash: escrowHash, isPending: isEscrowPending, isConfirming: isEscrowConfirming, isSuccess: isEscrowSuccess } = useEscrowWrite();
  const { track, confirm } = useTxTracker();

  const vaultAddress = selectedChain ? escrowVaultAddress(selectedChain.id) : null;
  const isOfferNative = offerToken ? isNative(offerToken.address) : false;

  const { needsApproval, approve, isApproving, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useTokenApproval(
    offerToken?.address as Address | null,
    vaultAddress,
    offerAmount && offerToken ? parseUnits(offerAmount, offerToken.decimals) : null
  );

  const isVip = user?.vipStatus === 'approved';

  useEffect(() => {
    if (isApproveSuccess && txSteps[0]?.status === 'active') {
      setTxSteps(prev => {
        const next = [...prev];
        next[0] = { ...next[0], status: 'success' };
        next[1] = { ...next[1], status: 'active' };
        return next;
      });
    }
  }, [isApproveSuccess]);

  useEffect(() => {
    if (escrowHash && txSteps.length > 0) {
      const idx = needsApproval ? 1 : 0;
      setTxSteps(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], txHash: escrowHash, chainId: selectedChain?.id, status: 'active' };
        return next;
      });
      track({ chainId: selectedChain!.id, hash: escrowHash, kind: 'create_pool', refType: 'pool' });
    }
  }, [escrowHash]);

  useEffect(() => {
    if (isEscrowSuccess && txSteps.length > 0) {
      const idx = needsApproval ? 1 : 0;
      setTxSteps(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'success' };
        return next;
      });
      handleConfirm();
    }
  }, [isEscrowSuccess]);

  const handleConfirm = async () => {
    if (!escrowHash) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolId = (window as any).__tempPoolId; // from POST /api/pools response
      await confirm(`/api/pools/${poolId}/confirm`, escrowHash);
      router.push(`/pools/${poolId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    }
  };

  const handleNext = () => {
    setError(null);

    // Validation
    if (step === 1 && market === 'vip' && !isVip) {
      setError('VIP market requires approved VIP status');
      return;
    }

    if (step === 2) {
      if (!selectedChain) {
        setError('Please select a chain');
        return;
      }
      if (!isChainDeployed(selectedChain.id)) {
        setError('Contract not deployed on this chain');
        return;
      }
      if (connectedChain?.id !== selectedChain.id) {
        setError('Please switch your wallet to the selected chain');
        return;
      }
    }

    if (step === 3) {
      if (!offerToken || !requestToken) {
        setError('Please select both tokens');
        return;
      }
      if (!offerAmount || parseFloat(offerAmount) <= 0) {
        setError('Invalid offer amount');
        return;
      }
      if (!requestAmount || parseFloat(requestAmount) <= 0) {
        setError('Invalid request amount');
        return;
      }
    }

    if (step < 5) setStep((step + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSubmit = async () => {
    setError(null);
    setTxSteps([]);

    if (!selectedChain || !offerToken || !requestToken || !userAddress) return;

    try {
      // 1. Create DRAFT pool
      const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: selectedChain.id,
          kind: 'SWAP',
          offerToken: offerToken.address,
          offerAmount: parseUnits(offerAmount, offerToken.decimals).toString(),
          requestToken: requestToken.address,
          requestAmount: parseUnits(requestAmount, requestToken.decimals).toString(),
          expiresAt,
          allowPartial,
          visibility: market,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to create pool: ${res.status}`);
      }

      const { id } = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__tempPoolId = id;

      // 2. Setup tx steps
      const steps = [];
      if (needsApproval && !isOfferNative) {
        steps.push({ label: 'Approve token', status: 'pending' as const });
      }
      steps.push({ label: 'Create pool on-chain', status: 'pending' as const });
      setTxSteps(steps);

      // 3. Approve if needed
      if (needsApproval && !isOfferNative) {
        setTxSteps(prev => {
          const next = [...prev];
          next[0] = { ...next[0], status: 'active' };
          return next;
        });
        approve();
      } else {
        // 4. Create pool directly
        setTxSteps(prev => {
          const next = [...prev];
          next[0] = { ...next[0], status: 'active' };
          return next;
        });
        executeCreatePool();
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create pool');
    }
  };

  const executeCreatePool = () => {
    if (!selectedChain || !offerToken || !requestToken || !vaultAddress) return;

    const offerWei = parseUnits(offerAmount, offerToken.decimals);
    const requestWei = parseUnits(requestAmount, requestToken.decimals);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + expirySeconds);

    escrowWrite({
      address: vaultAddress,
      abi: escrowVaultAbi,
      functionName: 'createPool',
      args: [offerToken.address as Address, offerWei, requestToken.address as Address, requestWei, deadline, allowPartial],
      value: isOfferNative ? offerWei : undefined,
    });
  };

  // Auto-execute createPool after approve success
  useEffect(() => {
    if (isApproveSuccess && txSteps.length > 0 && txSteps[0].status === 'success' && !isEscrowPending && !escrowHash) {
      executeCreatePool();
    }
  }, [isApproveSuccess, txSteps]);

  if (!ready) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#050806' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center grid-bg" style={{ background: '#050806' }}>
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

  const price = offerAmount && requestAmount && parseFloat(offerAmount) > 0
    ? (parseFloat(requestAmount) / parseFloat(offerAmount)).toFixed(6)
    : null;

  return (
    <div className="min-h-screen pt-20 pb-16 grid-bg" style={{ background: '#050806' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white mb-2">Create Pool</h1>
          <p style={{ color: '#666' }}>Register your OTC pool on-chain</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-10">
          {[
            { num: 1, label: 'Market' },
            { num: 2, label: 'Chain' },
            { num: 3, label: 'Assets' },
            { num: 4, label: 'Terms' },
            { num: 5, label: 'Review' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                  style={{
                    background: step >= s.num ? 'linear-gradient(135deg, #00c9a7, #00a88a)' : 'rgba(255,255,255,0.05)',
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
              {i < 4 && (
                <div
                  className="flex-1 h-px mx-2 transition-all duration-500"
                  style={{ background: step > s.num ? '#00c9a7' : '#1f1f1f' }}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.2)' }}>
            <p className="text-sm" style={{ color: '#FF4D5E' }}>⚠️ {error}</p>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #00c9a7, #6366f1, #00ff88)' }} />
          <div className="p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-xl font-bold text-white mb-6">Select Market</h2>
                  <div className="grid gap-4">
                    <button
                      onClick={() => setMarket('public')}
                      className="p-4 rounded-xl text-left transition-all duration-200"
                      style={{
                        background: market === 'public' ? 'rgba(0,201,167,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${market === 'public' ? 'rgba(0,201,167,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                          style={{ background: market === 'public' ? 'rgba(0,201,167,0.2)' : 'rgba(255,255,255,0.05)', color: '#00c9a7' }}
                        >
                          ⟠↔⟠
                        </div>
                        <div>
                          <p className="font-bold text-white">Public Swap</p>
                          <p className="text-sm" style={{ color: '#666' }}>Crypto ↔ Crypto (Anyone can take)</p>
                        </div>
                        {market === 'public' && <span className="ml-auto text-lg">✓</span>}
                      </div>
                    </button>

                    <button
                      onClick={() => setMarket('vip')}
                      disabled={!isVip}
                      className="p-4 rounded-xl text-left transition-all duration-200"
                      style={{
                        background: market === 'vip' ? 'rgba(0,201,167,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${market === 'vip' ? 'rgba(0,201,167,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        opacity: isVip ? 1 : 0.5,
                        cursor: isVip ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                          style={{ background: market === 'vip' ? 'rgba(0,201,167,0.2)' : 'rgba(255,255,255,0.05)', color: '#00ff88' }}
                        >
                          💎
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-2">
                            VIP Desk
                            {!isVip && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(245,166,35,0.1)', color: '#f5a623' }}>Approval Required</span>}
                          </p>
                          <p className="text-sm" style={{ color: '#666' }}>
                            {isVip ? 'Crypto ↔ Crypto or Fiat (VIP only)' : 'Request VIP access from /vip'}
                          </p>
                        </div>
                        {market === 'vip' && <span className="ml-auto text-lg">✓</span>}
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-xl font-bold text-white mb-6">Select Chain</h2>
                  <ChainSelect value={selectedChain?.id || null} onChange={setSelectedChain} onlyDeployed />

                  {selectedChain && connectedChain?.id !== selectedChain.id && (
                    <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}>
                      <p className="text-sm mb-3" style={{ color: '#f5a623' }}>
                        Your wallet is on {connectedChain?.name}. Switch to {selectedChain.name} to continue.
                      </p>
                      <button
                        onClick={() => switchChain?.({ chainId: selectedChain.id })}
                        className="btn-secondary text-sm px-4 py-2"
                      >
                        Switch Network
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 3 && selectedChain && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-xl font-bold text-white mb-6">Configure Assets</h2>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#00c9a7' }}>
                        Offer (You Lock)
                      </label>
                      <TokenSelect chainId={selectedChain.id} value={offerToken?.address || null} onChange={setOfferToken} />
                      {offerToken && (
                        <div className="mt-3">
                          <AmountInput
                            value={offerAmount}
                            onChange={setOfferAmount}
                            symbol={offerToken.symbol}
                            decimals={offerToken.decimals}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#00ff88' }}>
                        Request (You Receive)
                      </label>
                      <TokenSelect chainId={selectedChain.id} value={requestToken?.address || null} onChange={setRequestToken} />
                      {requestToken && (
                        <div className="mt-3">
                          <AmountInput
                            value={requestAmount}
                            onChange={setRequestAmount}
                            symbol={requestToken.symbol}
                            decimals={requestToken.decimals}
                          />
                        </div>
                      )}
                    </div>

                    {price && offerToken && requestToken && (
                      <div className="p-4 rounded-xl" style={{ background: '#0d0d0d' }}>
                        <p className="text-sm mb-1" style={{ color: '#666' }}>Exchange Rate</p>
                        <p className="text-base font-mono font-semibold text-white">
                          1 {offerToken.symbol} = {price} {requestToken.symbol}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-xl font-bold text-white mb-6">Pool Terms</h2>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#888' }}>Expiry</label>
                      <div className="flex flex-wrap gap-2">
                        {EXPIRY_OPTIONS.map(opt => (
                          <button
                            key={opt.seconds}
                            onClick={() => setExpirySeconds(opt.seconds)}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: expirySeconds === opt.seconds ? 'rgba(0,201,167,0.15)' : 'rgba(255,255,255,0.04)',
                              color: expirySeconds === opt.seconds ? '#00c9a7' : '#666',
                              border: `1px solid ${expirySeconds === opt.seconds ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allowPartial}
                          onChange={e => setAllowPartial(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-white">Allow partial fills</span>
                      </label>
                      <p className="text-xs mt-1" style={{ color: '#666' }}>
                        Takers can fill part of the pool instead of the full amount
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 5 && selectedChain && offerToken && requestToken && (
                <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-xl font-bold text-white mb-6">Review & Create</h2>

                  <div className="space-y-3 mb-8">
                    {[
                      { label: 'Market', value: market === 'public' ? 'Public Swap' : 'VIP Desk' },
                      { label: 'Chain', value: selectedChain.name },
                      { label: 'Offer', value: `${offerAmount} ${offerToken.symbol}` },
                      { label: 'Request', value: `${requestAmount} ${requestToken.symbol}` },
                      { label: 'Rate', value: price ? `1 ${offerToken.symbol} = ${price} ${requestToken.symbol}` : '—' },
                      { label: 'Expiry', value: `${Math.floor(expirySeconds / 3600)}h` },
                      { label: 'Partial Fills', value: allowPartial ? 'Allowed' : 'Not Allowed' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center py-3 px-4 rounded-lg" style={{ background: '#0d0d0d' }}>
                        <span className="text-sm" style={{ color: '#666' }}>{item.label}</span>
                        <span className="text-sm font-semibold text-white font-mono">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {txSteps.length === 0 ? (
                    <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                      <p className="text-sm" style={{ color: '#888' }}>
                        {needsApproval && !isOfferNative ? '⚠️ Approval + on-chain transaction required' : '⚠️ On-chain transaction required'}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <TxStepper steps={txSteps} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 mt-8">
              {step > 1 && txSteps.length === 0 && (
                <button className="btn-secondary flex-1" onClick={handleBack}>← Back</button>
              )}
              {step < 5 ? (
                <button className="btn-primary flex-1 justify-center" onClick={handleNext}>Next →</button>
              ) : (
                <button
                  className="btn-primary flex-1 justify-center"
                  onClick={handleSubmit}
                  disabled={isApproving || isApproveConfirming || isEscrowPending || isEscrowConfirming || txSteps.some(s => s.status === 'active')}
                >
                  {isApproving || isApproveConfirming || isEscrowPending || isEscrowConfirming ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Processing...
                    </span>
                  ) : '🚀 Create Pool'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
