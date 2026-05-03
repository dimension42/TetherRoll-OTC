'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { MOCK_POOLS, MOCK_ESCROWS } from '@/lib/mockData';
import { ADMIN_ADDRESSES } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const ADMIN_EMAILS = ['admin@tetherroll.com', 'culture@culturing.org'];

type Lang = 'ko' | 'en';

type AdminTab = 'dashboard' | 'pools' | 'escrows' | 'disputes' | 'settings';

function shortenAddr(addr: string) { return addr.slice(0, 6) + '...' + addr.slice(-4); }

const TAB_LIST: { key: AdminTab; label: Record<Lang, string>; icon: string }[] = [
  { key: 'dashboard', label: { ko: '대시보드', en: 'Dashboard' }, icon: '📊' },
  { key: 'pools', label: { ko: 'Pool 관리', en: 'Pool Mgmt' }, icon: '🏊' },
  { key: 'escrows', label: { ko: 'Escrow 관리', en: 'Escrow Mgmt' }, icon: '🔒' },
  { key: 'disputes', label: { ko: '분쟁 중재', en: 'Disputes' }, icon: '⚖️' },
  { key: 'settings', label: { ko: '수수료 설정', en: 'Fee Settings' }, icon: '⚙️' },
];

const i18n: Record<Lang, Record<string, string>> = {
  ko: {
    adminAccess: 'Admin Access',
    connectAdmin: '어드민 계정으로 지갑을 연결해주세요',
    accessDenied: '접근 불가',
    noPermission: '어드민 권한이 없는 지갑입니다',
    dashboard: 'Admin 대시보드',
    disputesPending: '분쟁 대기',
    recentActivity: '최근 Pool 활동',
    poolMgmt: 'Pool 관리',
    escrowMgmt: 'Escrow 관리',
    disputes: '분쟁 중재',
    disputeDesc: '2-of-3 멀티시그 중재자 판정이 필요한 분쟁 목록',
    noDisputes: '처리할 분쟁이 없습니다',
    awaitingArb: '중재 대기 중',
    rulingA: 'PartyA 승소 판정',
    rulingB: 'PartyB 승소 판정',
    feeSettings: '수수료 설정',
    feeDesc: '변경 시 48시간 타임락 후 적용됩니다. 3-of-5 멀티시그 필요.',
    feeRates: '수수료율 설정 (basis points)',
    tradingFee: '거래 수수료 (Trading Fee)',
    tradingFeeDesc: 'Crypto↔Crypto 스왑 완료 시',
    relayFee: '중계 수수료 (Relay Fee)',
    relayFeeDesc: 'Escrow COMPLETED 전환 시',
    depositFee: '보증금 수수료 (Deposit Fee)',
    depositFeeDesc: '에스크로 생성 시 선공제',
    timelockWarn: '⚠️ 타임락 경고',
    timelockDesc: '수수료 변경은 멀티시그 승인 후 48시간 타임락이 적용됩니다. 즉시 적용되지 않습니다.',
    submitChange: '변경 제안 (멀티시그)',
    platformStatus: '플랫폼 상태',
    contractStatus: '컨트랙트 상태',
    normal: '정상',
    network: '네트워크',
    emergencyPause: '🚨 긴급 정지 (Pause)',
    withdrawFees: '💰 수수료 수익 출금',
    tableId: 'ID',
    tableOffer: '제공',
    tableRequest: '요청',
    tableCreator: '등록자',
    tableStatus: '상태',
    tableDeposit: '보증금',
    tableAction: '액션',
    forceCancel: '강제 취소',
    tableAssetA: '자산A',
    tableAssetB: '자산B',
    tableExpiry: '만료',
    emergencyExpire: '긴급 만료',
    dispute: '분쟁',
    ipfsEvidence: 'IPFS 증거 해시',
    checkEvidence: 'IPFS에서 증거 확인',
  },
  en: {
    adminAccess: 'Admin Access',
    connectAdmin: 'Please connect with an admin wallet',
    accessDenied: 'Access Denied',
    noPermission: 'This wallet does not have admin privileges',
    dashboard: 'Admin Dashboard',
    disputesPending: 'Disputes Pending',
    recentActivity: 'Recent Pool Activity',
    poolMgmt: 'Pool Management',
    escrowMgmt: 'Escrow Management',
    disputes: 'Dispute Arbitration',
    disputeDesc: 'Disputes requiring 2-of-3 multisig arbitrator ruling',
    noDisputes: 'No disputes to process',
    awaitingArb: 'Awaiting Arbitration',
    rulingA: 'Rule in favor of PartyA',
    rulingB: 'Rule in favor of PartyB',
    feeSettings: 'Fee Settings',
    feeDesc: 'Changes apply after 48-hour timelock. Requires 3-of-5 multisig.',
    feeRates: 'Fee Rates (basis points)',
    tradingFee: 'Trading Fee',
    tradingFeeDesc: 'On Crypto↔Crypto swap completion',
    relayFee: 'Relay Fee',
    relayFeeDesc: 'On Escrow COMPLETED transition',
    depositFee: 'Deposit Fee',
    depositFeeDesc: 'Deducted upfront on escrow creation',
    timelockWarn: '⚠️ Timelock Warning',
    timelockDesc: 'Fee changes are subject to 48-hour timelock after multisig approval. Not applied immediately.',
    submitChange: 'Propose Change (Multisig)',
    platformStatus: 'Platform Status',
    contractStatus: 'Contract Status',
    normal: 'Normal',
    network: 'Network',
    emergencyPause: '🚨 Emergency Pause',
    withdrawFees: '💰 Withdraw Fee Revenue',
    tableId: 'ID',
    tableOffer: 'Offer',
    tableRequest: 'Request',
    tableCreator: 'Creator',
    tableStatus: 'Status',
    tableDeposit: 'Deposit',
    tableAction: 'Action',
    forceCancel: 'Force Cancel',
    tableAssetA: 'Asset A',
    tableAssetB: 'Asset B',
    tableExpiry: 'Expiry',
    emergencyExpire: 'Emergency Expire',
    dispute: 'Dispute',
    ipfsEvidence: 'IPFS Evidence Hash',
    checkEvidence: 'Check evidence on IPFS',
  },
};

export default function AdminPage() {
  const { user, authenticated, login, ready } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [lang, setLang] = useState<Lang>('ko');
  const [tradingFee, setTradingFee] = useState('30');   // bps
  const [relayFee, setRelayFee] = useState('50');
  const [depositFee, setDepositFee] = useState('10');

  const t = i18n[lang];

  const address = user?.wallet?.address;
  const email = user?.email?.address || user?.google?.email;

  const isAdminByWallet = address &&
    ADMIN_ADDRESSES.map(a => a.toLowerCase()).includes(address.toLowerCase());
  const isAdminByEmail = email && ADMIN_EMAILS.includes(email.toLowerCase());
  const isAdmin = authenticated && (isAdminByWallet || isAdminByEmail);

  const devMode = ADMIN_ADDRESSES[0] === '0x0000000000000000000000000000000000000000';

  if (!ready) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#ff4466', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid rgba(255,68,102,0.2)' }}>
          <p className="text-5xl mb-4">🔐</p>
          <h2 className="text-2xl font-bold text-white mb-2">{t.adminAccess}</h2>
          <p className="mb-6" style={{ color: '#666' }}>{t.connectAdmin}</p>
          <button
            onClick={login}
            className="px-8 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'rgba(255,68,102,0.15)', border: '1px solid rgba(255,68,102,0.4)' }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin && !devMode) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="text-center p-12 rounded-3xl" style={{ background: '#111', border: '1px solid rgba(255,68,102,0.2)' }}>
          <p className="text-5xl mb-4">⛔</p>
          <h2 className="text-2xl font-bold" style={{ color: '#ff4466' }}>{t.accessDenied}</h2>
          <p className="mt-2" style={{ color: '#666' }}>{t.noPermission}</p>
          <p className="text-xs mt-2 font-mono" style={{ color: '#555' }}>{email || address || 'Unknown'}</p>
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
            <div className="flex items-center justify-between mb-6">
              <div
                className="px-3 py-2 rounded-lg flex items-center gap-2"
                style={{ background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.2)' }}
              >
                <span className="w-2 h-2 rounded-full bg-red-400 pulse-dot" />
                <span className="text-xs font-bold" style={{ color: '#ff4466' }}>ADMIN</span>
              </div>
              <button
                onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
                className="px-2 py-1 rounded text-xs font-bold transition-all"
                style={{ background: 'rgba(0,201,167,0.1)', color: '#00c9a7', border: '1px solid rgba(0,201,167,0.2)' }}
              >
                {lang === 'ko' ? 'EN' : 'KR'}
              </button>
            </div>

            <nav className="space-y-1">
              {TAB_LIST.map(item => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                  style={{
                    background: tab === item.key ? 'rgba(0,201,167,0.1)' : 'transparent',
                    color: tab === item.key ? '#00c9a7' : '#666',
                  }}
                >
                  <span>{item.icon}</span>
                  {item.label[lang]}
                  {item.key === 'disputes' && disputedEscrows.length > 0 && (
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
              <h1 className="text-3xl font-black text-white mb-8">{t.dashboard}</h1>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Volume', value: '$' + (totalVolume / 1e6).toFixed(1) + 'M', color: '#00c9a7', icon: '💰' },
                  { label: 'Platform Fees', value: '$' + (totalFees / 1000).toFixed(1) + 'K', color: '#00ff88', icon: '💸' },
                  { label: 'Active Pools', value: activePools.length.toString(), color: '#6366f1', icon: '🏊' },
                  { label: t.disputesPending, value: disputedEscrows.length.toString(), color: '#ff4466', icon: '⚠️' },
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
                  <h3 className="font-bold text-white">{t.recentActivity}</h3>
                </div>
                <div className="divide-y" style={{ borderColor: '#1a1a1a' }}>
                  {MOCK_POOLS.slice(0, 5).map(pool => (
                    <div key={pool.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #00c9a7, #6366f1)' }} />
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
                          {formatDistanceToNow(pool.createdAt, { addSuffix: true, ...(lang === 'ko' ? { locale: ko } : {}) })}
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
              <h1 className="text-3xl font-black text-white mb-8">{t.poolMgmt}</h1>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                      {[t.tableId, t.tableOffer, t.tableRequest, t.tableCreator, t.tableStatus, t.tableDeposit, t.tableAction].map(h => (
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
                              onClick={() => alert('Admin Force Cancel - Requires multisig approval')}
                            >
                              {t.forceCancel}
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
              <h1 className="text-3xl font-black text-white mb-8">{t.escrowMgmt}</h1>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                      {[t.tableId, 'PartyA', 'PartyB', t.tableAssetA, t.tableAssetB, t.tableStatus, t.tableExpiry, t.tableAction].map(h => (
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
                          {new Date(e.deadline).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
                        </td>
                        <td className="px-4 py-3">
                          {e.status === 'ACTIVE' && (
                            <button
                              className="text-xs px-3 py-1 rounded-lg transition-all"
                              style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}
                              onClick={() => alert('emergencyExpire() - Admin emergency expiration')}
                            >
                              {t.emergencyExpire}
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
              <h1 className="text-3xl font-black text-white mb-2">{t.disputes}</h1>
              <p className="mb-8" style={{ color: '#666' }}>{t.disputeDesc}</p>

              {disputedEscrows.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-xl font-bold text-white">{t.noDisputes}</p>
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
                          <span className="font-bold text-white">Escrow #{e.escrowId} {t.dispute}</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
                          {t.awaitingArb}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 rounded-lg" style={{ background: '#0d0d0d' }}>
                          <p className="text-xs mb-1" style={{ color: '#555' }}>PartyA (Crypto)</p>
                          <p className="font-mono text-sm text-white">{shortenAddr(e.partyA)}</p>
                          <p className="text-sm font-bold mt-1" style={{ color: '#00c9a7' }}>{e.assetAAmount} {e.assetASymbol}</p>
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
                        <p className="text-xs mb-1" style={{ color: '#fb923c' }}>{t.ipfsEvidence}</p>
                        <p className="text-xs font-mono" style={{ color: '#888' }}>
                          QmXyz...{e.escrowId}abc ({t.checkEvidence})
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                          style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}
                          onClick={() => alert(`resolveByArbitrator(${e.escrowId}, partyA) - Requires multisig signature`)}
                        >
                          {t.rulingA}
                        </button>
                        <button
                          className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                          style={{ background: 'rgba(99,102,241,0.1)', color: '#a78bfa', border: '1px solid rgba(99,102,241,0.3)' }}
                          onClick={() => alert(`resolveByArbitrator(${e.escrowId}, partyB) - Requires multisig signature`)}
                        >
                          {t.rulingB}
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
              <h1 className="text-3xl font-black text-white mb-2">{t.feeSettings}</h1>
              <p className="mb-8" style={{ color: '#666' }}>{t.feeDesc}</p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                  <h3 className="font-bold text-white mb-6">{t.feeRates}</h3>
                  <div className="space-y-4">
                    {[
                      { label: t.tradingFee, key: 'trading', value: tradingFee, setter: setTradingFee, desc: t.tradingFeeDesc },
                      { label: t.relayFee, key: 'relay', value: relayFee, setter: setRelayFee, desc: t.relayFeeDesc },
                      { label: t.depositFee, key: 'deposit', value: depositFee, setter: setDepositFee, desc: t.depositFeeDesc },
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
                          <span className="text-sm shrink-0 font-bold" style={{ color: '#00c9a7' }}>
                            = {(Number(f.value) / 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.15)' }}>
                    <p className="text-sm" style={{ color: '#00c9a7' }}>{t.timelockWarn}</p>
                    <p className="text-xs mt-1" style={{ color: '#666' }}>
                      {t.timelockDesc}
                    </p>
                  </div>

                  <button
                    className="btn-primary w-full justify-center mt-6"
                    onClick={() => alert('setFees() transaction - Requires 3-of-5 multisig signature')}
                  >
                    {t.submitChange}
                  </button>
                </div>

                <div className="p-6 rounded-2xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                  <h3 className="font-bold text-white mb-6">{t.platformStatus}</h3>
                  <div className="space-y-3">
                    {[
                      { label: t.contractStatus, value: t.normal, color: '#00ff88' },
                      { label: 'PoolRegistry', value: 'Active', color: '#00ff88' },
                      { label: 'EscrowVault', value: 'Active', color: '#00ff88' },
                      { label: 'FeeDistributor', value: 'Active', color: '#00ff88' },
                      { label: t.network, value: 'Sepolia', color: '#00c9a7' },
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
                      onClick={() => alert('pause() - Requires 2-of-5 multisig (Emergency Pause)')}
                    >
                      {t.emergencyPause}
                    </button>
                    <button
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                      style={{ background: 'rgba(0,201,167,0.08)', color: '#00c9a7', border: '1px solid rgba(0,201,167,0.2)' }}
                      onClick={() => alert('Withdraw fees - Gnosis Safe multisig execution')}
                    >
                      {t.withdrawFees}
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
