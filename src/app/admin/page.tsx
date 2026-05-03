'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MOCK_POOLS, MOCK_ESCROWS } from '@/lib/mockData';
import { ADMIN_ADDRESSES } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

type AdminTab = 'dashboard' | 'pools' | 'escrows' | 'disputes' | 'settings';

function shortenAddr(addr: string) { return addr.slice(0, 6) + '...' + addr.slice(-4); }

const TAB_LIST: { key: AdminTab; label: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', icon: '📊' },
  { key: 'pools', label: 'Pool 관리', icon: '🏊' },
  { key: 'escrows', label: 'Escrow 관리', icon: '🔒' },
  { key: 'disputes', label: '분쟁 중재', icon: '⚖️' },
  { key: 'settings', label: '수수료 설정', icon: '⚙️' },
];

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [tradingFee, setTradingFee] = useState('30');   // bps
  const [relayFee, setRelayFee] = useState('50');
  const [depositFee, setDepositFee] = useState('10');

  const isAdmin = isConnected && address &&
    ADMIN_ADDRESSES.map(a => a.toLowerCase()).includes(address.toLowerCase());

  // Allow all connected wallets in development (address zero matches any wallet)
  const devMode = ADMIN_ADDRESSES[0] === '0x0000000000000000000000000000000000000000';

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid rgba(255,68,102,0.2)' }}>
          <p className="text-5xl mb-4">🔐</p>
          <h2 className="text-2xl font-bold text-white mb-2">Admin Access</h2>
          <p className="mb-6" style={{ color: '#666' }}>어드민 계정으로 지갑을 연결해주세요</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!isAdmin && !devMode) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid rgba(255,68,102,0.2)' }}>
          <p className="text-5xl mb-4">⛔</p>
          <h2 className="text-2xl font-bold" style={{ color: '#ff4466' }}>접근 불가</h2>
          <p className="mt-2" style={{ color: '#666' }}>어드민 권한이 없는 지갑입니다</p>
          <p className="text-xs mt-2 font-mono" style={{ color: '#555' }}>{address}</p>
        </div>
      </div>
    );
  }

  const totalVolume = 124700000;
  const totalFees = 623500;
  const disputedEscrows = MOCK_ESCROWS.filter(e => e.status === 'DISPUTED');
  const activePools = MOCK_POOLS.filter(p => p.status === 'OPEN' || p.status === 'PARTIAL');

  return (
    <div className="min-h-screen pt-16" style={{ background: '#080808' }}>
      <div className="flex">
        {/* Sidebar */}
        <div
          className="w-56 min-h-screen pt-4 shrink-0 hidden md:block"
          style={{ background: '#0d0d0d', borderRight: '1px solid #1a1a1a' }}
        >
          <div className="px-4 py-4">
            <div
              className="px-3 py-2 rounded-lg flex items-center gap-2 mb-6"
              style={{ background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.2)' }}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 pulse-dot" />
              <span className="text-xs font-bold" style={{ color: '#ff4466' }}>ADMIN</span>
            </div>

            <nav className="space-y-1">
              {TAB_LIST.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                  style={{
                    background: tab === t.key ? 'rgba(240,180,41,0.1)' : 'transparent',
                    color: tab === t.key ? '#f0b429' : '#666',
                  }}
                >
                  <span>{t.icon}</span>
                  {t.label}
                  {t.key === 'disputes' && disputedEscrows.length > 0 && (
                    <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#ff4466', color: '#fff' }}>
                      {disputedEscrows.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Dashboard tab */}
          {tab === 'dashboard' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-3xl font-black text-white mb-8">Admin 대시보드</h1>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Volume', value: '$' + (totalVolume / 1e6).toFixed(1) + 'M', color: '#f0b429', icon: '💰' },
                  { label: 'Platform Fees', value: '$' + (totalFees / 1000).toFixed(1) + 'K', color: '#00ff88', icon: '💸' },
                  { label: 'Active Pools', value: activePools.length.toString(), color: '#6366f1', icon: '🏊' },
                  { label: '분쟁 대기', value: disputedEscrows.length.toString(), color: '#ff4466', icon: '⚠️' },
                ].map(s => (
                  <div key={s.label} className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                    <div className="text-2xl mb-3">{s.icon}</div>
                    <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-sm" style={{ color: '#666' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Recent activity */}
              <div className="rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <h3 className="font-bold text-white">최근 Pool 활동</h3>
                </div>
                <div className="divide-y" style={{ borderColor: '#1a1a1a' }}>
                  {MOCK_POOLS.slice(0, 5).map(pool => (
                    <div key={pool.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #f0b429, #6366f1)' }} />
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {pool.offerAmount} {pool.offerSymbol} → {pool.isFiat ? `${Number(pool.fiatAmount).toLocaleString()} ${pool.fiatCurrency}` : `${pool.requestAmount} ${pool.requestSymbol}`}
                          </p>
                          <p className="text-xs font-mono" style={{ color: '#555' }}>{shortenAddr(pool.creator)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`badge-${pool.status.toLowerCase()} px-2 py-0.5 rounded-full text-xs font-bold`}>
                          {pool.status}
                        </span>
                        <p className="text-xs mt-1" style={{ color: '#555' }}>
                          {formatDistanceToNow(pool.createdAt, { addSuffix: true, locale: ko })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Pools tab */}
          {tab === 'pools' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-3xl font-black text-white mb-8">Pool 관리</h1>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                      {['ID', '제공', '요청', '등록자', '상태', '보증금', '액션'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: '#555' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#1a1a1a' }}>
                    {MOCK_POOLS.map(pool => (
                      <tr key={pool.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-white">#{pool.poolId}</td>
                        <td className="px-4 py-3 text-white">{pool.offerAmount} {pool.offerSymbol}</td>
                        <td className="px-4 py-3 text-white">
                          {pool.isFiat ? `${Number(pool.fiatAmount).toLocaleString()} ${pool.fiatCurrency}` : `${pool.requestAmount} ${pool.requestSymbol}`}
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ color: '#888' }}>{shortenAddr(pool.creator)}</td>
                        <td className="px-4 py-3">
                          <span className={`badge-${pool.status.toLowerCase()} px-2 py-0.5 rounded-full text-xs font-bold`}>
                            {pool.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: '#888' }}>{pool.depositAmount}</td>
                        <td className="px-4 py-3">
                          {(pool.status === 'OPEN' || pool.status === 'PARTIAL') && (
                            <button
                              className="text-xs px-3 py-1 rounded-lg transition-all"
                              style={{ background: 'rgba(255,68,102,0.1)', color: '#ff4466', border: '1px solid rgba(255,68,102,0.2)' }}
                              onClick={() => alert('관리자 강제 취소 - 멀티시그 승인 필요')}
                            >
                              강제 취소
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Escrows tab */}
          {tab === 'escrows' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-3xl font-black text-white mb-8">Escrow 관리</h1>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                      {['ID', 'PartyA', 'PartyB', '자산A', '자산B', '상태', '만료', '액션'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: '#555' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#1a1a1a' }}>
                    {MOCK_ESCROWS.map(e => (
                      <tr key={e.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-white">#{e.escrowId}</td>
                        <td className="px-4 py-3 font-mono" style={{ color: '#888' }}>{shortenAddr(e.partyA)}</td>
                        <td className="px-4 py-3 font-mono" style={{ color: '#888' }}>{shortenAddr(e.partyB)}</td>
                        <td className="px-4 py-3 text-white">{e.assetAAmount} {e.assetASymbol}</td>
                        <td className="px-4 py-3 text-white">
                          {e.isFiat ? `${Number(e.assetBAmount).toLocaleString()} ${e.fiatCurrency}` : `${e.assetBAmount} ${e.assetBSymbol}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge-${e.status.toLowerCase()} px-2 py-0.5 rounded-full text-xs font-bold`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: e.deadline < Date.now() + 86400000 ? '#ff4466' : '#888' }}>
                          {new Date(e.deadline).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3">
                          {e.status === 'ACTIVE' && (
                            <button
                              className="text-xs px-3 py-1 rounded-lg transition-all"
                              style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}
                              onClick={() => alert('emergencyExpire() - 관리자 긴급 만료')}
                            >
                              긴급 만료
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Disputes tab */}
          {tab === 'disputes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-3xl font-black text-white mb-2">분쟁 중재</h1>
              <p className="mb-8" style={{ color: '#666' }}>2-of-3 멀티시그 중재자 판정이 필요한 분쟁 목록</p>

              {disputedEscrows.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-xl font-bold text-white">처리할 분쟁이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {disputedEscrows.map(e => (
                    <div
                      key={e.id}
                      className="p-6 rounded-2xl"
                      style={{ background: '#111', border: '1px solid rgba(251,146,60,0.2)' }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full bg-orange-400 pulse-dot" />
                          <span className="font-bold text-white">Escrow #{e.escrowId} 분쟁</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
                          중재 대기 중
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 rounded-lg" style={{ background: '#0d0d0d' }}>
                          <p className="text-xs mb-1" style={{ color: '#555' }}>PartyA (Crypto)</p>
                          <p className="font-mono text-sm text-white">{shortenAddr(e.partyA)}</p>
                          <p className="text-sm font-bold mt-1" style={{ color: '#f0b429' }}>{e.assetAAmount} {e.assetASymbol}</p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ background: '#0d0d0d' }}>
                          <p className="text-xs mb-1" style={{ color: '#555' }}>PartyB</p>
                          <p className="font-mono text-sm text-white">{shortenAddr(e.partyB)}</p>
                          <p className="text-sm font-bold mt-1" style={{ color: '#00ff88' }}>
                            {e.isFiat ? `${Number(e.assetBAmount).toLocaleString()} ${e.fiatCurrency}` : `${e.assetBAmount} ${e.assetBSymbol}`}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.1)' }}>
                        <p className="text-xs mb-1" style={{ color: '#fb923c' }}>IPFS 증거 해시</p>
                        <p className="text-xs font-mono" style={{ color: '#888' }}>
                          QmXyz...{e.escrowId}abc (IPFS에서 증거 확인)
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                          style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}
                          onClick={() => alert(`resolveByArbitrator(${e.escrowId}, partyA) - 멀티시그 서명 필요`)}
                        >
                          PartyA 승소 판정
                        </button>
                        <button
                          className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                          style={{ background: 'rgba(99,102,241,0.1)', color: '#a78bfa', border: '1px solid rgba(99,102,241,0.3)' }}
                          onClick={() => alert(`resolveByArbitrator(${e.escrowId}, partyB) - 멀티시그 서명 필요`)}
                        >
                          PartyB 승소 판정
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Settings tab */}
          {tab === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-3xl font-black text-white mb-2">수수료 설정</h1>
              <p className="mb-8" style={{ color: '#666' }}>변경 시 48시간 타임락 후 적용됩니다. 3-of-5 멀티시그 필요.</p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                  <h3 className="font-bold text-white mb-6">수수료율 설정 (basis points)</h3>
                  <div className="space-y-4">
                    {[
                      { label: '거래 수수료 (Trading Fee)', key: 'trading', value: tradingFee, setter: setTradingFee, desc: 'Crypto↔Crypto 스왑 완료 시' },
                      { label: '중계 수수료 (Relay Fee)', key: 'relay', value: relayFee, setter: setRelayFee, desc: 'Escrow COMPLETED 전환 시' },
                      { label: '보증금 수수료 (Deposit Fee)', key: 'deposit', value: depositFee, setter: setDepositFee, desc: '에스크로 생성 시 선공제' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium mb-1 text-white">{f.label}</label>
                        <p className="text-xs mb-2" style={{ color: '#555' }}>{f.desc}</p>
                        <div className="flex gap-3 items-center">
                          <input
                            className="input-dark"
                            type="number"
                            value={f.value}
                            onChange={e => f.setter(e.target.value)}
                            min="0"
                            max="1000"
                          />
                          <span className="text-sm shrink-0 font-bold" style={{ color: '#f0b429' }}>
                            = {(Number(f.value) / 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(240,180,41,0.05)', border: '1px solid rgba(240,180,41,0.15)' }}>
                    <p className="text-sm" style={{ color: '#f0b429' }}>⚠️ 타임락 경고</p>
                    <p className="text-xs mt-1" style={{ color: '#666' }}>
                      수수료 변경은 멀티시그 승인 후 48시간 타임락이 적용됩니다. 즉시 적용되지 않습니다.
                    </p>
                  </div>

                  <button
                    className="btn-primary w-full justify-center mt-6"
                    onClick={() => alert('setFees() 트랜잭션 - 3-of-5 멀티시그 서명 필요')}
                  >
                    변경 제안 (멀티시그)
                  </button>
                </div>

                <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                  <h3 className="font-bold text-white mb-6">플랫폼 상태</h3>
                  <div className="space-y-3">
                    {[
                      { label: '컨트랙트 상태', value: '정상', color: '#00ff88' },
                      { label: 'PoolRegistry', value: 'Active', color: '#00ff88' },
                      { label: 'EscrowVault', value: 'Active', color: '#00ff88' },
                      { label: 'FeeDistributor', value: 'Active', color: '#00ff88' },
                      { label: '네트워크', value: 'Sepolia', color: '#f0b429' },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between items-center p-3 rounded-lg" style={{ background: '#0d0d0d' }}>
                        <span className="text-sm" style={{ color: '#888' }}>{s.label}</span>
                        <span className="text-sm font-bold" style={{ color: s.color }}>● {s.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 space-y-3">
                    <button
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                      style={{ background: 'rgba(255,68,102,0.08)', color: '#ff4466', border: '1px solid rgba(255,68,102,0.2)' }}
                      onClick={() => alert('pause() - 2-of-5 멀티시그 필요 (긴급 정지)')}
                    >
                      🚨 긴급 정지 (Pause)
                    </button>
                    <button
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                      style={{ background: 'rgba(240,180,41,0.08)', color: '#f0b429', border: '1px solid rgba(240,180,41,0.2)' }}
                      onClick={() => alert('수익 출금 - Gnosis Safe 멀티시그 실행')}
                    >
                      💰 수수료 수익 출금
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
