'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: 'Connect Wallet',
    desc: 'Connect with MetaMask, WalletConnect, or any supported wallet.',
    icon: '🔗',
    color: '#6366f1',
  },
  {
    num: '02',
    title: 'Register Pool',
    desc: 'Set your offer & request assets (crypto or cash) and deposit collateral.',
    icon: '📋',
    color: '#00c9a7',
  },
  {
    num: '03',
    title: 'Match & Escrow',
    desc: 'Once matched, both parties\' assets are locked in smart contract escrow.',
    icon: '🤝',
    color: '#00ff88',
  },
  {
    num: '04',
    title: 'Trade & Confirm',
    desc: 'For Crypto↔Fiat, confirm cash delivery to trigger on-chain settlement.',
    icon: '✅',
    color: '#f472b6',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-4" style={{ background: 'rgba(255,255,255,0.01)' }}>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#00c9a7' }}>
            How It Works
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            OTC Trading in 4 Steps
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div
            className="absolute top-12 left-0 right-0 h-px hidden lg:block"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,201,167,0.3), transparent)' }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                viewport={{ once: true }}
                className="text-center relative"
              >
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 relative z-10"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}22, ${step.color}08)`,
                    border: `1px solid ${step.color}33`,
                    boxShadow: `0 0 30px ${step.color}20`,
                  }}
                >
                  {step.icon}
                  <span
                    className="absolute -top-3 -right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: step.color, color: '#000' }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#888' }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
