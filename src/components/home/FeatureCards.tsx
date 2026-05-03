'use client';

import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';

const features = [
  {
    icon: '🔒',
    title: 'On-Chain Escrow',
    desc: 'Smart contracts protect your assets. Both parties\' funds are securely locked until trade completion.',
    color: '#00c9a7',
    glow: 'rgba(0,201,167,0.15)',
  },
  {
    icon: '💱',
    title: 'Cash ↔ Crypto',
    desc: 'Offline cash trades secured by on-chain deposits. Trade directly without platform intermediaries.',
    color: '#00ff88',
    glow: 'rgba(0,255,136,0.15)',
  },
  {
    icon: '🌐',
    title: 'Multi-Wallet',
    desc: 'Supports MetaMask, WalletConnect, Coinbase Wallet, Rabby, and all major wallets.',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.15)',
  },
  {
    icon: '⚡',
    title: 'Auto Settlement',
    desc: 'Instant settlement on confirmation. Fees are automatically distributed by smart contracts.',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.15)',
  },
  {
    icon: '⚖️',
    title: 'Dispute Resolution',
    desc: 'Multisig arbitrators resolve disputes within 48 hours based on on-chain evidence.',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.15)',
  },
  {
    icon: '🛡️',
    title: 'Non-Custodial',
    desc: 'Assets are always held in smart contracts or user wallets. The platform never has access.',
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
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#00c9a7' }}>
            Why TetherRoll
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            A New Standard for Trading
          </h2>
          <p style={{ color: '#888' }} className="text-lg max-w-2xl mx-auto">
            Fully decentralized OTC trading protected by on-chain escrow and smart contracts
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
                glareColor="#00c9a7"
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
