'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import Link from 'next/link';
import StatsBar from '@/components/home/StatsBar';
import FeatureCards from '@/components/home/FeatureCards';
import HowItWorks from '@/components/home/HowItWorks';

const HeroScene = dynamic(() => import('@/components/home/HeroScene'), { ssr: false });

export default function HomePage() {
  return (
    <div className="grid-bg min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-0 top-0 w-full md:w-2/3 h-full opacity-70">
            <HeroScene />
          </div>
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 70% 50%, transparent 20%, #080808 70%)' }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.2)', color: '#00c9a7' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
              Live on Sepolia Testnet
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 text-white">
              Crypto × Fiat<br />
              <span className="gradient-text">OTC Trading</span>
            </h1>

            <p className="text-lg md:text-xl mb-8 leading-relaxed" style={{ color: '#999' }}>
              Fully decentralized OTC trading platform secured by on-chain escrow.<br />
              Even cash trades are guaranteed by smart contracts.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <Link href="/pools" className="btn-primary text-base px-8 py-4">
                Explore Pools
              </Link>
              <Link href="/pools/create" className="btn-secondary text-base px-8 py-4">
                Create Trade
              </Link>
            </div>

            <div className="flex flex-wrap gap-8">
              {[
                { label: '24h Volume', value: '$4.2M' },
                { label: 'Active Pools', value: '847' },
                { label: 'Success Rate', value: '99.2%' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-sm" style={{ color: '#666' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-5 h-8 rounded-full border-2 border-gray-700 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-gray-500" />
          </div>
        </motion.div>
      </section>

      <StatsBar />
      <FeatureCards />
      <HowItWorks />

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(0,201,167,0.08), rgba(99,102,241,0.08))',
              border: '1px solid rgba(0,201,167,0.15)',
            }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Get Started Now</h2>
            <p className="text-lg mb-8" style={{ color: '#888' }}>Connect your wallet and register your first OTC Pool</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/pools/create" className="btn-primary text-base px-10 py-4">Register Pool</Link>
              <Link href="/pools" className="btn-secondary text-base px-10 py-4">View Pools</Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-black font-black text-xs" style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}>TR</div>
            <span className="text-sm font-semibold text-white">TetherRoll</span>
          </div>
          <p className="text-xs" style={{ color: '#555' }}>© 2026 TetherRoll. Smart contracts audited. Non-custodial.</p>
          <div className="flex gap-6">
            {['Docs', 'Github', 'Discord'].map(l => (
              <a key={l} href="#" className="text-xs transition-colors hover:text-white" style={{ color: '#555' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
