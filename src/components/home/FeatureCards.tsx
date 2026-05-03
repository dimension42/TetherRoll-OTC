'use client';

import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';

const features = [
  {
    icon: '🔒',
    title: 'On-Chain Escrow',
    desc: '스마트 컨트랙트가 자산을 보호합니다. 거래 완료까지 양측 자산이 안전하게 잠금됩니다.',
    color: '#f0b429',
    glow: 'rgba(240,180,41,0.15)',
  },
  {
    icon: '💱',
    title: 'Cash ↔ Crypto',
    desc: '오프라인 현금 거래도 온체인 보증금으로 안전하게. 플랫폼 중계자 없이 직접 거래.',
    color: '#00ff88',
    glow: 'rgba(0,255,136,0.15)',
  },
  {
    icon: '🌐',
    title: 'Multi-Wallet',
    desc: 'MetaMask, WalletConnect, Coinbase Wallet, Rabby 등 모든 지갑을 지원합니다.',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.15)',
  },
  {
    icon: '⚡',
    title: 'Auto Settlement',
    desc: '거래 확인 즉시 자동 정산. 수수료도 스마트 컨트랙트가 자동으로 분배합니다.',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.15)',
  },
  {
    icon: '⚖️',
    title: 'Dispute Resolution',
    desc: '분쟁 발생 시 멀티시그 중재자가 온체인 증거를 기반으로 48시간 내 판정합니다.',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.15)',
  },
  {
    icon: '🛡️',
    title: 'Non-Custodial',
    desc: '자산은 항상 스마트 컨트랙트 또는 사용자 지갑에만 보관됩니다. 플랫폼은 접근 불가.',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.15)',
  },
];

export default function FeatureCards() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#f0b429' }}>
            Why OTC Platform
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            거래의 새로운 기준
          </h2>
          <p style={{ color: '#888' }} className="text-lg max-w-2xl mx-auto">
            온체인 에스크로와 스마트 컨트랙트로 보호되는 완전 탈중앙화 OTC 거래
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Tilt
                tiltMaxAngleX={8}
                tiltMaxAngleY={8}
                glareEnable={true}
                glareMaxOpacity={0.06}
                glareColor="#f0b429"
                glarePosition="all"
                glareBorderRadius="16px"
                scale={1.02}
                transitionSpeed={400}
              >
                <div
                  className="p-6 rounded-2xl h-full"
                  style={{
                    background: '#111111',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: `0 0 40px ${f.glow}`,
                    transition: 'border-color 0.3s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = f.color + '44';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                    style={{ background: f.glow, border: `1px solid ${f.color}22` }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#888' }}>{f.desc}</p>
                </div>
              </Tilt>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
