'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import Link from 'next/link';
import Tilt from 'react-parallax-tilt';

const SecurityScene = lazy(() => import('./SecurityScene'));

// ─── Animated Counter ───────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{isInView ? `${count.toLocaleString()}${suffix}` : '0'}</span>;
}

// ─── Floating Particles Background ─────────────────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            background: i % 3 === 0 ? '#00c9a7' : i % 3 === 1 ? '#6366f1' : '#00ff88',
            opacity: 0.3,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: Math.random() * 4 + 3,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

// ─── Escrow Flow Step ───────────────────────────────────────────────────────
function EscrowStep({ step, index, total }: { step: { title: string; desc: string }; index: number; total: number }) {
  return (
    <motion.div
      className="flex flex-col items-center text-center relative"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.2, duration: 0.5 }}
      viewport={{ once: true }}
    >
      <motion.div
        className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mb-3"
        style={{
          background: 'rgba(0,201,167,0.15)',
          border: '2px solid #00c9a7',
          color: '#00c9a7',
        }}
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        transition={{ delay: index * 0.2 + 0.1, type: 'spring' }}
        viewport={{ once: true }}
      >
        {index + 1}
      </motion.div>
      <h4 className="text-white font-semibold text-sm mb-1">{step.title}</h4>
      <p className="text-gray-500 text-xs max-w-[120px]">{step.desc}</p>
      {index < total - 1 && (
        <motion.div
          className="hidden md:block absolute top-7 left-[calc(50%+40px)] w-[calc(100%-80px)] h-[2px]"
          style={{ background: 'linear-gradient(90deg, #00c9a7, #6366f1)' }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          transition={{ delay: index * 0.2 + 0.3, duration: 0.5 }}
          viewport={{ once: true }}
        />
      )}
    </motion.div>
  );
}

// ─── Feature Card ───────────────────────────────────────────────────────────
const features = [
  {
    title: 'On-Chain Escrow',
    desc: 'Both assets are locked in an audited smart contract until the trade is mutually confirmed. Neither party can withdraw unilaterally.',
    icon: '🔒',
    color: '#00c9a7',
  },
  {
    title: 'Cash ↔ Crypto',
    desc: 'Trade physical cash for crypto with full on-chain security guarantees. The smart contract acts as your escrow -- no physical middleman required.',
    icon: '💵',
    color: '#6366f1',
  },
  {
    title: 'Multi-Wallet Support',
    desc: 'Connect with MetaMask, WalletConnect, Coinbase Wallet, Rabby, and more. Any EVM-compatible wallet works seamlessly.',
    icon: '👛',
    color: '#00ff88',
  },
  {
    title: 'Instant Settlement',
    desc: 'Once both parties confirm delivery, settlement is automatic. Fees are distributed and funds released in the same transaction.',
    icon: '⚡',
    color: '#00c9a7',
  },
  {
    title: 'Dispute Resolution',
    desc: '2-of-3 multisig arbitration system resolves disputes within 48 hours. Fair, transparent, and immutable on-chain.',
    icon: '⚖️',
    color: '#ff4466',
  },
  {
    title: 'Non-Custodial',
    desc: 'Your assets are always in smart contracts or your own wallet. TetherRoll never holds custody of your funds at any point.',
    icon: '🛡️',
    color: '#6366f1',
  },
];

const escrowSteps = [
  { title: 'Pool Registration', desc: 'Maker creates a trading pool with terms' },
  { title: 'Match', desc: 'Taker accepts and funds are locked' },
  { title: 'Escrow Lock', desc: 'Smart contract holds both sides' },
  { title: 'Delivery Confirm', desc: 'Both parties confirm receipt' },
  { title: 'Settlement', desc: 'Auto-release with fee distribution' },
];

const stats = [
  { value: 124, suffix: 'M+', label: 'Trading Volume', prefix: '$' },
  { value: 12000, suffix: '+', label: 'Completed Trades', prefix: '' },
  { value: 99.2, suffix: '%', label: 'Success Rate', prefix: '' },
  { value: 2, suffix: 'h', label: 'Avg Settlement', prefix: '<' },
];

export default function FeaturesPage() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  return (
    <div className="min-h-screen bg-[#080808] pt-20">
      {/* ─── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(0,201,167,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(99,102,241,0.08) 0%, transparent 50%)',
          }}
        />
        <FloatingParticles />
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Built for Secure{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #00c9a7, #6366f1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              OTC Trading
            </span>
          </motion.h1>
          <motion.p
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            TetherRoll eliminates counterparty risk in over-the-counter crypto and fiat
            trades through trustless on-chain escrow. Trade with confidence, settle instantly.
          </motion.p>
          <motion.div
            className="mt-8 flex gap-4 justify-center flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Link
              href="/pools"
              className="px-6 py-3 rounded-xl font-semibold text-black"
              style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
            >
              Start Trading
            </Link>
            <Link
              href="/pools/create"
              className="px-6 py-3 rounded-xl font-semibold text-white border border-white/10"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              Register Pool
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── 3D Security Visualization ────────────────────────────────── */}
      <section className="py-20 relative">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Fortified by Smart Contracts
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Every trade is protected by audited, immutable on-chain logic. No human can
              override the escrow without consensus.
            </p>
          </motion.div>
          <motion.div
            className="w-full h-[350px] md:h-[450px] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(17,17,17,0.8)',
              border: '1px solid rgba(0,201,167,0.15)',
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {isClient && <Suspense fallback={null}><SecurityScene /></Suspense>}
          </motion.div>
        </div>
      </section>

      {/* ─── Feature Deep-Dive ────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-white text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Everything You Need for Safe OTC
          </motion.h2>
          <div className="space-y-20">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                className={`flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 md:gap-16`}
                initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {/* Icon/Illustration side */}
                <Tilt
                  tiltMaxAngleX={8}
                  tiltMaxAngleY={8}
                  glareEnable
                  glareMaxOpacity={0.15}
                  className="w-full md:w-1/2"
                >
                  <div
                    className="aspect-video rounded-2xl flex items-center justify-center relative overflow-hidden"
                    style={{
                      background: '#111',
                      border: `1px solid ${feat.color}22`,
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${feat.color}15, transparent 70%)`,
                      }}
                    />
                    <span className="text-6xl md:text-7xl relative z-10">{feat.icon}</span>
                  </div>
                </Tilt>
                {/* Text side */}
                <div className="w-full md:w-1/2">
                  <h3 className="text-2xl font-bold text-white mb-3">{feat.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Statistics ───────────────────────────────────────────────── */}
      <section className="py-20 relative">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(0,201,167,0.05) 0%, transparent 70%)',
          }}
        />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-white text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Trusted by Traders Worldwide
          </motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="rounded-2xl p-6 text-center"
                style={{
                  background: 'rgba(17,17,17,0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-2xl md:text-3xl font-black text-white mb-1">
                  {stat.prefix}
                  <Counter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How Escrow Works ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-white text-center mb-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            How Escrow Works
          </motion.h2>
          <motion.p
            className="text-gray-400 text-center mb-14 max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Five simple steps from pool creation to settlement. Fully automated,
            fully trustless.
          </motion.p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-4">
            {escrowSteps.map((step, i) => (
              <EscrowStep key={step.title} step={step} index={i} total={escrowSteps.length} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ──────────────────────────────────────────────── */}
      <section className="py-24 relative">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 80%, rgba(99,102,241,0.1) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <motion.h2
            className="text-3xl md:text-5xl font-black text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Ready to Trade Securely?
          </motion.h2>
          <motion.p
            className="text-gray-400 mb-8 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Join thousands of traders using TetherRoll for safe, fast OTC settlements.
          </motion.p>
          <motion.div
            className="flex gap-4 justify-center flex-wrap"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link
              href="/pools"
              className="px-8 py-4 rounded-xl font-bold text-black text-lg"
              style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
            >
              Start Trading Now
            </Link>
            <Link
              href="/pools/create"
              className="px-8 py-4 rounded-xl font-bold text-white text-lg"
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.4)',
              }}
            >
              Register Your Pool
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
