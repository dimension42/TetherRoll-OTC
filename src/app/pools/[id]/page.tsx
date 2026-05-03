'use client';

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MOCK_POOLS } from '@/lib/mockData';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';

function shortenAddr(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function PoolDetailPage() {
  const { id } = useParams();
  const { address, isConnected } = useAccount();
  const pool = MOCK_POOLS.find(p => p.id === id);

  if (!pool) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-2xl font-bold text-white mb-2">Pool을 찾을 수 없습니다</p>
          <Link href="/pools" className="btn-secondary mt-4">Pool 목록으로</Link>
        </div>
      </div>
    );
  }

  const isOwner = address?.toLowerCase() === pool.creator.toLowerCase();
  const canMatch = !isOwner && (pool.status === 'OPEN' || pool.status === 'PARTIAL');

  return (
    <div className="min-h-screen pt-20 pb-16 grid-bg" style={{ background: '#080808' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-8" style={{ color: '#666' }}>
          <Link href="/pools" className="hover:text-white transition-colors">Pools</Link>
          <span>/</span>
          <span style={{ color: '#f0b429' }}>Pool #{pool.poolId}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Main card */}
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            {/* Top gradient bar */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #f0b429, #6366f1, #00ff88)' }} />

            <div className="p-8">
              {/* Status & type */}
              <div className="flex items-center gap-3 mb-6">
                <span className={`px-3 py-1 rounded-full text-sm font-bold badge-${pool.status.toLowerCase()}`}>
                  ● {pool.status}
                </span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: pool.isFiat ? 'rgba(59,130,246,0.1)' : 'rgba(240,180,41,0.1)',
                    color: pool.isFiat ? '#60a5fa' : '#f0b429',
                    border: pool.isFiat ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(240,180,41,0.2)',
                  }}
                >
                  {pool.isFiat ? '💵 Cash ↔ Crypto' : '⟠ Crypto ↔ Crypto'}
                </span>
              </div>

              {/* Trade pair */}
              <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                <div className="flex-1 p-6 rounded-xl text-center" style={{ background: 'rgba(240,180,41,0.05)', border: '1px solid rgba(240,180,41,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#f0b429' }}>제공 (Offer)</p>
                  <p className="text-4xl font-black text-white">{pool.offerAmount}</p>
                  <p className="text-xl font-bold mt-1" style={{ color: '#f0b429' }}>{pool.offerSymbol}</p>
                </div>

                <div className="text-4xl">⇄</div>

                <div className="flex-1 p-6 rounded-xl text-center" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#00ff88' }}>요청 (Request)</p>
                  <p className="text-4xl font-black text-white">
                    {pool.isFiat ? Number(pool.fiatAmount).toLocaleString() : pool.requestAmount}
                  </p>
                  <p className="text-xl font-bold mt-1" style={{ color: '#00ff88' }}>
                    {pool.isFiat ? pool.fiatCurrency : pool.requestSymbol}
                  </p>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: '보증금', value: `${pool.depositAmount} ${pool.offerSymbol}` },
                  { label: '충족률', value: `${(pool.filledPercent / 100).toFixed(0)}%` },
                  { label: '등록시각', value: formatDistanceToNow(pool.createdAt, { addSuffix: true, locale: ko }) },
                  { label: '만료시각', value: format(pool.expiresAt, 'MM/dd HH:mm') },
                ].map(d => (
                  <div key={d.label} className="p-4 rounded-lg" style={{ background: '#0d0d0d' }}>
                    <p className="text-xs mb-1" style={{ color: '#555' }}>{d.label}</p>
                    <p className="text-sm font-semibold text-white">{d.value}</p>
                  </div>
                ))}
              </div>

              {/* Creator */}
              <div className="flex items-center gap-3 p-4 rounded-lg mb-6" style={{ background: '#0d0d0d' }}>
                <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #f0b429, #6366f1)' }} />
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#555' }}>등록자</p>
                  <p className="text-sm font-mono text-white">{pool.creator}</p>
                </div>
                {isOwner && (
                  <span className="ml-auto px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(240,180,41,0.1)', color: '#f0b429' }}>나의 Pool</span>
                )}
              </div>

              {/* Action buttons */}
              {!isConnected ? (
                <div className="flex justify-center">
                  <ConnectButton label="지갑 연결 후 거래 참여" />
                </div>
              ) : isOwner ? (
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1">만료 연장</button>
                  <button className="btn-danger flex-1">Pool 취소</button>
                </div>
              ) : canMatch ? (
                <button
                  className="btn-primary w-full text-base py-4 justify-center"
                  onClick={() => alert('에스크로 생성 - 컨트랙트 연동 후 활성화됩니다')}
                >
                  이 Pool에 참여하기 (에스크로 생성)
                </button>
              ) : (
                <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', color: '#666' }}>
                  {pool.status === 'COMPLETED' ? '거래가 완료된 Pool입니다' : '현재 참여할 수 없는 Pool입니다'}
                </div>
              )}
            </div>
          </div>

          {/* Security note */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)' }}>
            <p className="text-sm" style={{ color: '#666' }}>
              🔒 <span style={{ color: '#00ff88' }}>온체인 에스크로 보호</span> — 참여 시 양측 자산이 스마트 컨트랙트에 잠금되며, 거래 완료 전 어느 누구도 자산에 접근할 수 없습니다.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
