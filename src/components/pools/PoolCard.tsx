'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { Pool } from '@/lib/types';
import { fmtAmount } from '@/lib/format';
import { Countdown } from '@/components/ui/Countdown';
import { StatusChip } from '@/components/ui/StatusChip';
import { CHAIN_META } from '@/lib/chains';

/**
 * Pool 카드 (v2) — 리스트 화면에서 사용
 */
export default function PoolCard({ pool, index }: { pool: Pool; index: number }) {
  const isFiat = pool.kind === 'FIAT';
  const chainMeta = CHAIN_META[pool.chain_id];

  // FIAT 풀: 표시 금액 포맷 (KRW는 fmtKrw 대신 toLocaleString)
  const offerDisplay = isFiat && pool.trade_type === 'FIAT_CRYPTO'
    ? `₩${parseFloat(pool.offer_amount).toLocaleString('ko-KR')}`
    : fmtAmount(pool.offer_amount_wei, pool.offer_decimals);

  const requestDisplay = isFiat && pool.trade_type === 'CRYPTO_FIAT'
    ? `₩${parseFloat(pool.request_amount).toLocaleString('ko-KR')}`
    : fmtAmount(pool.request_amount_wei, pool.request_decimals);

  const offerSymbol = isFiat && pool.trade_type === 'FIAT_CRYPTO' ? pool.fiat_currency : pool.offer_symbol;
  const requestSymbol = isFiat && pool.trade_type === 'CRYPTO_FIAT' ? pool.fiat_currency : pool.request_symbol;

  // 남은 비율 계산
  const remainingPct = pool.onchain_pool_id !== null
    ? Math.floor((parseFloat(pool.offer_remaining_wei) / parseFloat(pool.offer_amount_wei)) * 100)
    : 100;

  // 가격 (request per 1 offer)
  const price = parseFloat(pool.request_amount) / parseFloat(pool.offer_amount);
  const priceStr = price.toLocaleString('en-US', { maximumFractionDigits: 6 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/pools/${pool.id}`}>
        <div
          className="p-5 rounded-2xl card-hover transition-all duration-300"
          style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
        >
          {/* Header: 체인 배지 + 상태 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {chainMeta && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: 'rgba(0,201,167,0.1)',
                    color: '#00c9a7',
                    border: '1px solid rgba(0,201,167,0.2)',
                  }}
                >
                  {chainMeta.short}
                </span>
              )}
              {isFiat && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
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
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
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
            <StatusChip status={pool.status} type="pool" />
          </div>

          {/* Trade pair */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-center flex-1">
              <p className="text-2xl font-black text-white font-mono">{offerDisplay}</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#00c9a7' }}>{offerSymbol}</p>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>Offer</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <div className="h-px w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <span className="text-lg">→</span>
                <div className="h-px w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-black text-white font-mono">{requestDisplay}</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#00ff88' }}>{requestSymbol}</p>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>Request</p>
            </div>
          </div>

          {/* Price line */}
          <div className="mb-3 text-center">
            <p className="text-xs" style={{ color: '#888' }}>
              Price: <span className="font-mono font-semibold" style={{ color: '#f0f0f0' }}>{priceStr}</span> {requestSymbol} per {offerSymbol}
            </p>
          </div>

          {/* Remaining bar */}
          {pool.status === 'PARTIAL' && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: '#888' }}>Remaining</span>
                <span className="font-mono" style={{ color: '#00c9a7' }}>{remainingPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: '#1a1a1a' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${remainingPct}%`,
                    background: remainingPct > 50 ? '#00c9a7' : '#c084fc',
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer: 만료 */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
            <span className="text-xs" style={{ color: '#555' }}>
              Fee: <span className="font-mono" style={{ color: '#888' }}>{(pool.fee_bps / 100).toFixed(2)}%</span>
            </span>
            {pool.expires_at && (
              <div className="text-xs font-semibold">
                Expires: <Countdown until={pool.expires_at} />
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
