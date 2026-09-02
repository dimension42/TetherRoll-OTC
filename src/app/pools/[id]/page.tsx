'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { usePool } from '@/hooks/useEscrowVault';
import { PoolActions } from '@/components/pools/PoolActions';
import { TakePanel } from '@/components/pools/TakePanel';
import { RequestFiatTrade } from '@/components/pools/RequestFiatTrade';
import { RequestDeskTrade } from '@/components/custody/RequestDeskTrade';
import { StatusChip } from '@/components/ui/StatusChip';
import { Countdown } from '@/components/ui/Countdown';
import { AddressLink, TxLink } from '@/components/ui/AddressLink';
import { fmtAmount } from '@/lib/format';
import { CHAIN_META } from '@/lib/chains';
import { POOL_STATUS_ONCHAIN } from '@/lib/contracts/abi';
import { isChainDeployed } from '@/lib/contracts/addresses';
import type { Pool as PoolType, Trade } from '@/lib/types';

export default function PoolDetailPage() {
  const { id } = useParams();

  const [pool, setPool] = useState<PoolType | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 온체인 풀 조회 (10초 폴링)
  const { pool: onchainPool, refetch: refetchOnchain } = usePool(pool?.onchain_pool_id ?? null);

  const loadPool = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/pools/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Pool not found');
        } else {
          throw new Error(`Failed to load pool: ${res.status}`);
        }
        return;
      }
      const data = await res.json();
      setPool(data.pool);
      setTrades(data.trades || []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load pool');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPool();
  }, [id]);

  // 온체인 풀 10초마다 재조회
  useEffect(() => {
    if (!pool?.onchain_pool_id || !isChainDeployed(pool.chain_id)) return;

    const interval = setInterval(() => {
      refetchOnchain();
    }, 10000);

    return () => clearInterval(interval);
  }, [pool?.onchain_pool_id, pool?.chain_id]);

  // 온체인 상태로 DB 상태 덮어쓰기 (선호)
  const effectiveStatus = onchainPool && pool
    ? (POOL_STATUS_ONCHAIN[onchainPool.status] === 'OPEN' && onchainPool.offerRemaining < onchainPool.offerAmount ? 'PARTIAL' : POOL_STATUS_ONCHAIN[onchainPool.status])
    : pool?.status;

  const effectiveRemaining = onchainPool?.offerRemaining?.toString() ?? pool?.offer_remaining_wei;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center" style={{ background: '#050806' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center" style={{ background: '#050806' }}>
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-2xl font-bold text-white mb-2">{error || 'Pool not found'}</p>
          <Link href="/pools" className="btn-secondary mt-4">Back to Pools</Link>
        </div>
      </div>
    );
  }

  const isDesk = pool.kind === 'DESK';
  const chainMeta = !isDesk && pool.chain_id ? CHAIN_META[pool.chain_id] : null;
  const isFiat = pool.kind === 'FIAT';

  // FIAT 금액 포맷
  const offerDisplay = isFiat && pool.trade_type === 'FIAT_CRYPTO'
    ? `₩${parseFloat(String(pool.offer_amount ?? '0')).toLocaleString('ko-KR')}`
    : fmtAmount(pool.offer_amount_wei ?? '0', pool.offer_decimals ?? 18);

  const requestDisplay = isFiat && pool.trade_type === 'CRYPTO_FIAT'
    ? `₩${parseFloat(String(pool.request_amount ?? '0')).toLocaleString('ko-KR')}`
    : fmtAmount(pool.request_amount_wei ?? '0', pool.request_decimals ?? 18);

  const offerSymbol = isFiat && pool.trade_type === 'FIAT_CRYPTO' ? pool.fiat_currency : pool.offer_symbol;
  const requestSymbol = isFiat && pool.trade_type === 'CRYPTO_FIAT' ? pool.fiat_currency : pool.request_symbol;

  // 남은 비율
  const remainingPct = effectiveRemaining && pool.offer_amount_wei
    ? Math.floor((parseFloat(effectiveRemaining) / parseFloat(pool.offer_amount_wei)) * 100)
    : 100;

  // 가격
  const price = parseFloat(String(pool.request_amount ?? '1')) / parseFloat(String(pool.offer_amount ?? '1'));
  const priceStr = price.toLocaleString('en-US', { maximumFractionDigits: 6 });

  return (
    <div className="min-h-screen pt-20 pb-16" style={{ background: '#050806' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6" style={{ color: '#666' }}>
          <Link href="/pools" className="hover:text-white transition-colors">Pools</Link>
          <span>/</span>
          <span style={{ color: '#00c9a7' }}>{pool.id.slice(0, 8)}...</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Main card */}
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #00c9a7, #6366f1, #00ff88)' }} />

            <div className="p-8">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <StatusChip status={effectiveStatus || pool.status} type="pool" />
                {isDesk && (
                  <span
                    className="px-3 py-1 rounded-lg text-sm font-bold"
                    style={{
                      background: 'rgba(245,166,35,0.1)',
                      color: '#f5a623',
                      border: '1px solid rgba(245,166,35,0.3)',
                    }}
                    title="플랫폼 지갑이 보관하는 거래입니다 (컨트랙트 에스크로 아님)"
                  >
                    🏦 Platform Custody
                  </span>
                )}
                {!isDesk && chainMeta && (
                  <span
                    className="px-3 py-1 rounded-lg text-sm font-bold"
                    style={{
                      background: 'rgba(0,201,167,0.1)',
                      color: '#00c9a7',
                      border: '1px solid rgba(0,201,167,0.2)',
                    }}
                  >
                    {chainMeta.name}
                  </span>
                )}
                {isFiat && !isDesk && (
                  <span
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: 'rgba(59,130,246,0.1)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59,130,246,0.2)',
                    }}
                  >
                    💵 FIAT
                  </span>
                )}
                {pool.allow_partial && (
                  <span
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: 'rgba(168,85,247,0.1)',
                      color: '#c084fc',
                      border: '1px solid rgba(168,85,247,0.2)',
                    }}
                  >
                    Partial OK
                  </span>
                )}
              </div>

              {/* Trade pair */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="p-6 rounded-xl text-center" style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00c9a7' }}>Offer</p>
                  <p className="text-3xl font-black text-white font-mono">{offerDisplay}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: '#00c9a7' }}>{offerSymbol}</p>
                </div>

                <div className="flex items-center justify-center text-4xl">→</div>

                <div className="p-6 rounded-xl text-center" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00ff88' }}>Request</p>
                  <p className="text-3xl font-black text-white font-mono">{requestDisplay}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: '#00ff88' }}>{requestSymbol}</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-6 p-4 rounded-lg text-center" style={{ background: '#050806' }}>
                <p className="text-xs mb-1" style={{ color: '#555' }}>Price</p>
                <p className="text-lg font-bold text-white font-mono">
                  {priceStr} {requestSymbol} per {offerSymbol}
                </p>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Maker', value: pool.maker_address ? <AddressLink address={pool.maker_address} chainId={pool.chain_id} short /> : '—' },
                  { label: 'Created', value: formatDistanceToNow(new Date(pool.created_at), { addSuffix: true }) },
                  { label: 'Expires', value: pool.expires_at ? <Countdown until={pool.expires_at} /> : 'Never' },
                  { label: 'Fee', value: `${((pool.fee_bps ?? 0) / 100).toFixed(2)}%` },
                  { label: 'Remaining', value: `${remainingPct}%` },
                  { label: 'Partial', value: pool.allow_partial ? 'Allowed' : 'No' },
                  ...(pool.onchain_pool_id ? [{ label: 'On-chain ID', value: pool.onchain_pool_id.toString() }] : []),
                  ...(pool.create_tx_hash ? [{ label: 'Create Tx', value: <TxLink hash={pool.create_tx_hash} chainId={pool.chain_id} label="View" /> }] : []),
                ].map((d, i) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: '#050806' }}>
                    <p className="text-xs mb-1" style={{ color: '#555' }}>{d.label}</p>
                    <p className="text-sm font-semibold text-white">{d.value}</p>
                  </div>
                ))}
              </div>

              {/* Remaining bar */}
              {(effectiveStatus === 'PARTIAL' || effectiveStatus === 'OPEN') && remainingPct < 100 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: '#888' }}>Pool Fill Progress</span>
                    <span className="font-mono" style={{ color: '#00c9a7' }}>{100 - remainingPct}% filled</span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: '#1a1a1a' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${100 - remainingPct}%`,
                        background: 'linear-gradient(90deg, #00c9a7, #00ff88)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions & Take Panel */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Maker actions */}
            {!isDesk && <PoolActions pool={pool} onSuccess={loadPool} />}

            {/* Take / Request panel */}
            {isDesk ? (
              <RequestDeskTrade pool={pool as unknown as import('@/components/custody/types').DeskPool} />
            ) : isFiat ? (
              <RequestFiatTrade pool={pool} />
            ) : (
              <TakePanel pool={{ ...pool, status: effectiveStatus || pool.status, offer_remaining_wei: effectiveRemaining || pool.offer_remaining_wei }} onSuccess={loadPool} />
            )}
          </div>

          {/* Related trades */}
          {trades.length > 0 && (
            <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
              <h3 className="text-lg font-bold text-white mb-4">Your Trades in This Pool</h3>
              <div className="space-y-2">
                {trades.map(trade => (
                  <Link
                    key={trade.id}
                    href={`/trades/${trade.id}`}
                    className="block p-4 rounded-lg transition-all hover:bg-white/5"
                    style={{ background: '#050806', border: '1px solid #2a2a2a' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-mono font-semibold text-white">
                          {trade.id.slice(0, 8)}...
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#666' }}>
                          {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <StatusChip status={trade.status} type="trade" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
