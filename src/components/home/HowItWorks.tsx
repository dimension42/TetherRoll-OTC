'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: '지갑 연결',
    desc: 'MetaMask, WalletConnect 등 원하는 지갑으로 연결합니다.',
    icon: '🔗',
    color: '#6366f1',
  },
  {
    num: '02',
    title: 'Pool 등록',
    desc: '제공할 자산과 원하는 자산(Crypto 또는 현금)을 등록하고 보증금을 납입합니다.',
    icon: '📋',
    color: '#f0b429',
  },
  {
    num: '03',
    title: '매칭 & 에스크로',
    desc: '상대방과 매칭되면 양측 자산이 스마트 컨트랙트 에스크로에 잠금됩니다.',
    icon: '🤝',
    color: '#00ff88',
  },
  {
    num: '04',
    title: '거래 & 확인',
    desc: 'Crypto↔Fiat는 오프라인 현금 교환 후 confirmDelivery로 온체인 정산됩니다.',
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
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#f0b429' }}>
            How It Works
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            4단계로 완성되는 OTC 거래
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div
            className="absolute top-12 left-0 right-0 h-px hidden lg:block"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.3), transparent)' }}
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
