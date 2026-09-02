'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { parseUnits, type Address, BaseError } from 'viem';
import { useEscrowWrite, useQuoteTake } from '@/hooks/useEscrowVault';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useTxTracker } from '@/hooks/useTxTracker';
import { AmountInput } from '@/components/ui/AmountInput';
import { TxStepper } from '@/components/ui/TxStepper';
import ChainGuard from '@/components/wallet/ChainGuard';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { escrowVaultAddress, isChainDeployed } from '@/lib/contracts/addresses';
import { isNative, findToken } from '@/lib/tokens';
import { fmtAmount } from '@/lib/format';
import type { Pool } from '@/lib/types';

export function TakePanel({ pool }: { pool: Pool; onSuccess?: () => void }) {
  const router = useRouter();
  const { address: userAddress, chain } = useAccount();
  const { write, hash, isPending, isConfirming, isSuccess } = useEscrowWrite();
  const { track } = useTxTracker();

  const [amount, setAmount] = useState('');
  const [txSteps, setTxSteps] = useState<Array<{ label: string; status: 'pending' | 'active' | 'success' | 'error'; txHash?: string; chainId?: number; error?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [tradingPaused, setTradingPaused] = useState(false);

  // 토큰 정보
  const offerToken = findToken(pool.chain_id, pool.offer_token);
  const requestToken = findToken(pool.chain_id, pool.request_token);
  const vaultAddress = escrowVaultAddress(pool.chain_id);

  // 수량 파싱
  const offerWanted = amount && offerToken ? parseUnits(amount, offerToken.decimals) : null;

  // quoteTake 조회
  const { quote } = useQuoteTake(pool.onchain_pool_id, offerWanted);

  // Approval
  const { needsApproval, approve, isApproving, isSuccess: isApproveSuccess } = useTokenApproval(
    requestToken?.address as Address | null,
    vaultAddress,
    quote?.requestDue || null
  );

  // 거래 일시중지 확인
  useEffect(() => {
    const checkPaused = async () => {
      try {
        const res = await fetch('/api/announcements');
        if (res.ok) {
          const data = await res.json();
          setTradingPaused(data.tradingPaused || false);
        }
      } catch {
        // 무시
      }
    };
    checkPaused();
  }, []);

  // Approve 완료 시
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

  // Take tx 전송 시
  useEffect(() => {
    if (hash && txSteps.length > 0) {
      const idx = needsApproval ? 1 : 0;
      setTxSteps(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'active', txHash: hash, chainId: pool.chain_id };
        return next;
      });
      track({ chainId: pool.chain_id, hash, kind: 'pool_take', refType: 'trade', refId: tradeId! });
    }
  }, [hash]);

  // Take 확인 완료 시
  useEffect(() => {
    if (isSuccess && txSteps.length > 0) {
      const idx = needsApproval ? 1 : 0;
      setTxSteps(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'success' };
        return next;
      });

      // confirm 엔드포인트 호출 (최대 20회, 3초 간격)
      (async () => {
        try {
          let attempts = 0;
          while (attempts < 20) {
            const res = await fetch(`/api/trades/${tradeId}/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ txHash: hash, kind: 'take' }),
            });

            if (res.status === 200) {
              // 성공
              const finalIdx = needsApproval ? 2 : 1;
              setTxSteps(prev => {
                const next = [...prev];
                next[finalIdx] = { ...next[finalIdx], status: 'success' };
                return next;
              });
              setTimeout(() => router.push(`/trades/${tradeId}`), 1500);
              return;
            } else if (res.status === 202) {
              // 대기 중
              attempts++;
              await new Promise(r => setTimeout(r, 3000));
            } else {
              throw new Error('Confirm failed');
            }
          }
          throw new Error('Confirmation timeout');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Confirm failed');
          const finalIdx = needsApproval ? 2 : 1;
          setTxSteps(prev => {
            const next = [...prev];
            next[finalIdx] = { ...next[finalIdx], status: 'error', error: err instanceof Error ? err.message : 'Failed' };
            return next;
          });
        }
      })();
    }
  }, [isSuccess]);

  const handleMax = () => {
    if (pool.offer_remaining_wei) {
      setAmount(fmtAmount(pool.offer_remaining_wei, pool.offer_decimals));
    }
  };

  const handleTake = async () => {
    if (!offerWanted || !quote || !pool.onchain_pool_id || !vaultAddress) return;

    setError(null);

    // POST /api/trades 먼저
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id, offerWanted: offerWanted.toString() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Create trade failed: ${res.status}`);
      }

      const data = await res.json();
      setTradeId(data.id);

      // Approval 필요하면 approve 먼저
      if (needsApproval) {
        setTxSteps([
          { label: 'Approve request token', status: 'pending' },
          { label: 'Sign take transaction', status: 'pending' },
          { label: 'Confirming on-chain', status: 'pending' },
        ]);
        approve();
      } else {
        setTxSteps([
          { label: 'Sign take transaction', status: 'pending' },
          { label: 'Confirming on-chain', status: 'pending' },
        ]);

        // 즉시 take 실행
        executeTake();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trade');
    }
  };

  const executeTake = () => {
    if (!offerWanted || !quote || !pool.onchain_pool_id || !vaultAddress) return;

    try {
      const isRequestNative = requestToken ? isNative(requestToken.address) : false;

      write({
        address: vaultAddress,
        abi: escrowVaultAbi,
        functionName: 'take',
        args: [BigInt(pool.onchain_pool_id), offerWanted],
        value: isRequestNative ? quote.requestDue : undefined,
      });
    } catch (err) {
      const message = err instanceof BaseError ? err.shortMessage : (err instanceof Error ? err.message : 'Transaction failed');
      setError(message);
      const idx = needsApproval ? 1 : 0;
      setTxSteps(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'error', error: message };
        return next;
      });
    }
  };

  // Approve 완료 후 take 실행
  useEffect(() => {
    if (isApproveSuccess && txSteps[0]?.status === 'success' && txSteps[1]?.status === 'active') {
      executeTake();
    }
  }, [isApproveSuccess, txSteps]);

  // 버튼 비활성화 이유
  const wrongChain = chain?.id !== pool.chain_id;
  const notConnected = !userAddress;
  const ownPool = userAddress?.toLowerCase() === pool.maker_address.toLowerCase();
  const notOpen = pool.status !== 'OPEN' && pool.status !== 'PARTIAL';
  const isExpired = pool.expires_at ? new Date(pool.expires_at) <= new Date() : false;
  const amountZero = !amount || parseFloat(amount) <= 0;
  const amountExceeds = offerWanted && pool.offer_remaining_wei ? offerWanted > BigInt(pool.offer_remaining_wei) : false;
  const noPartial = !pool.allow_partial && offerWanted && pool.offer_remaining_wei ? offerWanted !== BigInt(pool.offer_remaining_wei) : false;

  let disableReason = '';
  if (tradingPaused) disableReason = 'Trading paused';
  else if (notConnected) disableReason = 'Connect wallet';
  else if (wrongChain) disableReason = 'Switch to correct chain';
  else if (!isChainDeployed(pool.chain_id)) disableReason = 'Chain not deployed';
  else if (ownPool) disableReason = 'Cannot take own pool';
  else if (notOpen) disableReason = 'Pool not open';
  else if (isExpired) disableReason = 'Pool expired';
  else if (amountZero) disableReason = 'Enter amount';
  else if (amountExceeds) disableReason = 'Amount exceeds remaining';
  else if (noPartial) disableReason = 'Partial fill not allowed';

  const disabled = !!disableReason || isPending || isApproving || isConfirming;

  return (
    <ChainGuard>
      <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
        <h3 className="text-xl font-bold text-white mb-4">Take This Pool</h3>

        {txSteps.length > 0 ? (
          <TxStepper steps={txSteps} />
        ) : (
          <>
            {/* 수량 입력 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: '#888' }}>
                  Amount ({offerToken?.symbol})
                </span>
                <button
                  type="button"
                  onClick={handleMax}
                  className="text-xs font-semibold"
                  style={{ color: '#00c9a7', cursor: 'pointer' }}
                >
                  MAX: {pool.offer_remaining_wei ? fmtAmount(pool.offer_remaining_wei, pool.offer_decimals) : '0'}
                </button>
              </div>
              <AmountInput
                value={amount}
                onChange={setAmount}
                decimals={pool.offer_decimals}
                placeholder="0.0"
              />
            </div>

            {/* 견적 */}
            {quote && amount && parseFloat(amount) > 0 && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: '#050806', border: '1px solid #2a2a2a' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm" style={{ color: '#888' }}>You pay</span>
                  <span className="text-sm font-mono font-semibold text-white">
                    {fmtAmount(quote.requestDue, pool.request_decimals)} {requestToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm" style={{ color: '#888' }}>Platform fee (offer)</span>
                  <span className="text-sm font-mono" style={{ color: '#888' }}>
                    {fmtAmount(quote.feeOffer, pool.offer_decimals)} {offerToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm" style={{ color: '#888' }}>Platform fee (request)</span>
                  <span className="text-sm font-mono" style={{ color: '#888' }}>
                    {fmtAmount(quote.feeRequest, pool.request_decimals)} {requestToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid #2a2a2a' }}>
                  <span className="text-sm font-semibold" style={{ color: '#00ff88' }}>You receive</span>
                  <span className="text-sm font-mono font-semibold" style={{ color: '#00ff88' }}>
                    {fmtAmount(offerWanted! - quote.feeOffer, pool.offer_decimals)} {offerToken?.symbol}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm mb-4" style={{ color: '#FF4D5E' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleTake}
              disabled={disabled}
              className="w-full px-4 py-3 rounded-xl text-base font-bold transition-all"
              style={{
                background: disabled ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #00c9a7, #00a88a)',
                color: disabled ? '#555' : '#000',
                border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(0,201,167,0.3)'}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {disableReason || (isPending || isApproving ? 'Signing...' : isConfirming ? 'Confirming...' : 'Take Pool')}
            </button>

            {!pool.allow_partial && (
              <p className="text-xs mt-2 text-center" style={{ color: '#666' }}>
                This pool does not allow partial fills. You must take the full remaining amount.
              </p>
            )}
          </>
        )}
      </div>
    </ChainGuard>
  );
}
