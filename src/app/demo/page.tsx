'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Account {
  address: string;
  label: string;
  role: string;
  balances: { USDT: number; KRW: number };
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface StepData {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#080808',
  surface: '#111111',
  surfaceHover: '#1a1a1a',
  border: '#222222',
  borderActive: '#00c9a7',
  accent: '#00c9a7',
  accentDim: 'rgba(0, 201, 167, 0.15)',
  text: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#555555',
  success: '#00c9a7',
  warning: '#f5a623',
  error: '#ff4757',
  info: '#4a9eff',
};

const INITIAL_ACCOUNTS: Account[] = [
  { address: '0xAd...Admin', label: 'Admin', role: 'Platform Admin', balances: { USDT: 0, KRW: 0 } },
  { address: '0xAl...Alice', label: 'Alice', role: 'Maker (Seller)', balances: { USDT: 5000, KRW: 2000000 } },
  { address: '0xBo...Bob', label: 'Bob', role: 'Taker (Buyer)', balances: { USDT: 500, KRW: 5000000 } },
  { address: '0xFe...Platform', label: 'Fee Wallet', role: 'Platform Revenue', balances: { USDT: 0, KRW: 0 } },
];

const STEPS: StepData[] = [
  { id: 1, title: 'Pool Registration', description: 'Alice registers a sell pool: 1000 USDT for 1,350,000 KRW', status: 'pending' },
  { id: 2, title: 'Pool Matching', description: 'Bob finds and accepts the pool offer', status: 'pending' },
  { id: 3, title: 'Escrow Creation', description: 'Smart contract locks assets in escrow vault', status: 'pending' },
  { id: 4, title: 'Fiat Transfer', description: 'Bob sends 1,350,000 KRW to Alice\'s bank account', status: 'pending' },
  { id: 5, title: 'Delivery Confirmation', description: 'Both parties confirm the transaction', status: 'pending' },
  { id: 6, title: 'Settlement', description: 'Escrow releases USDT to Bob, fees collected', status: 'pending' },
  { id: 7, title: 'Platform Revenue', description: 'Fee wallet receives cumulative platform revenue', status: 'pending' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<StepData[]>(STEPS);
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Admin demo state
  const [feeRate, setFeeRate] = useState(0.3);
  const [relayFee, setRelayFee] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [disputeStatus, setDisputeStatus] = useState<'none' | 'raised' | 'resolved'>('none');

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  const resetDemo = () => {
    setCurrentStep(0);
    setSteps(STEPS);
    setAccounts(INITIAL_ACCOUNTS);
    setLogs([]);
    setIsAnimating(false);
    setFeeRate(0.3);
    setRelayFee(5);
    setIsPaused(false);
    setDisputeStatus('none');
  };

  const executeStep = async () => {
    if (isAnimating || currentStep >= 7) return;
    setIsAnimating(true);

    const nextStep = currentStep + 1;

    setSteps(prev => prev.map(s => {
      if (s.id === nextStep) return { ...s, status: 'active' };
      if (s.id < nextStep) return { ...s, status: 'completed' };
      return s;
    }));

    await new Promise(r => setTimeout(r, 500));

    switch (nextStep) {
      case 1: // Pool Registration
        addLog('TX: Alice calls registerPool()', 'info');
        await new Promise(r => setTimeout(r, 300));
        addLog('Pool created: SELL 1000 USDT @ 1,350 KRW/USDT', 'success');
        addLog('Pool ID: 0x7f3a...e2c1', 'info');
        addLog('Status: ACTIVE | Expires: 24h', 'info');
        break;

      case 2: // Pool Matching
        addLog('TX: Bob calls acceptPool(poolId)', 'info');
        await new Promise(r => setTimeout(r, 300));
        addLog('Match found: Bob <-> Alice Pool #0x7f3a', 'success');
        addLog('Trade pair confirmed: 1000 USDT / 1,350,000 KRW', 'info');
        break;

      case 3: // Escrow Creation
        addLog('TX: createEscrow() - Locking assets...', 'info');
        await new Promise(r => setTimeout(r, 400));
        addLog('Alice: 1000 USDT locked in escrow contract', 'warning');
        addLog('Bob: Security deposit (50 USDT) locked', 'warning');
        addLog('Platform fee deducted: 3 USDT (0.3%)', 'info');
        addLog('Escrow address: 0xEs...crow', 'success');
        setAccounts(prev => prev.map(a => {
          if (a.label === 'Alice') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT - 1000 } };
          if (a.label === 'Bob') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT - 50 } };
          return a;
        }));
        break;

      case 4: // Fiat Transfer
        addLog('Bob initiating KRW bank transfer...', 'info');
        await new Promise(r => setTimeout(r, 600));
        addLog('Transfer: 1,350,000 KRW -> Alice bank account', 'info');
        addLog('Bank confirmation pending...', 'warning');
        await new Promise(r => setTimeout(r, 400));
        addLog('Bank transfer confirmed - TX ref: KRW-2026-0503-7821', 'success');
        setAccounts(prev => prev.map(a => {
          if (a.label === 'Bob') return { ...a, balances: { ...a.balances, KRW: a.balances.KRW - 1350000 } };
          if (a.label === 'Alice') return { ...a, balances: { ...a.balances, KRW: a.balances.KRW + 1350000 } };
          return a;
        }));
        break;

      case 5: // Delivery Confirmation
        addLog('Awaiting confirmations...', 'info');
        await new Promise(r => setTimeout(r, 400));
        addLog('[CONFIRMED] Alice: KRW payment received', 'success');
        await new Promise(r => setTimeout(r, 300));
        addLog('[CONFIRMED] Bob: Ready for USDT release', 'success');
        addLog('Both parties confirmed - triggering settlement', 'info');
        break;

      case 6: // Settlement
        addLog('TX: settleEscrow() - Releasing funds...', 'info');
        await new Promise(r => setTimeout(r, 500));
        addLog('Bob receives: 997 USDT (1000 - 3 fee)', 'success');
        addLog('Bob security deposit returned: 50 USDT', 'success');
        addLog('Relay fee: 5 USDT -> Platform wallet', 'info');
        addLog('Total platform revenue this trade: 8 USDT', 'success');
        setAccounts(prev => prev.map(a => {
          if (a.label === 'Bob') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT + 997 + 50 } };
          if (a.label === 'Fee Wallet') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT + 8 } };
          return a;
        }));
        break;

      case 7: // Platform Revenue
        addLog('=== TRADE COMPLETE ===', 'success');
        addLog('Platform fee collected: 3 USDT (trading)', 'info');
        addLog('Relay fee collected: 5 USDT (relay)', 'info');
        addLog('Total revenue: 8 USDT', 'success');
        addLog('Cumulative platform balance: ' + (accounts.find(a => a.label === 'Fee Wallet')!.balances.USDT + 8) + ' USDT', 'success');
        break;
    }

    await new Promise(r => setTimeout(r, 300));

    setSteps(prev => prev.map(s => {
      if (s.id === nextStep) return { ...s, status: 'completed' };
      return s;
    }));

    setCurrentStep(nextStep);
    setIsAnimating(false);
  };

  const progressPercent = (currentStep / 7) * 100;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Progress Bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: COLORS.border, zIndex: 100 }}>
        <motion.div
          style={{ height: '100%', background: `linear-gradient(90deg, ${COLORS.accent}, #00ffd5)` }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            <span style={{ color: COLORS.accent }}>TetherRoll</span> OTC Trading Demo
          </h1>
          <span style={{ fontSize: 12, color: COLORS.textSecondary, background: COLORS.surface, padding: '4px 10px', borderRadius: 4, border: `1px solid ${COLORS.border}` }}>
            Simulation Mode
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: COLORS.surface, borderRadius: 8, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
            <button
              onClick={() => setActiveTab('user')}
              style={{
                padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: activeTab === 'user' ? COLORS.accent : 'transparent',
                color: activeTab === 'user' ? '#000' : COLORS.textSecondary,
                transition: 'all 0.2s',
              }}
            >
              User Demo
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              style={{
                padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: activeTab === 'admin' ? COLORS.accent : 'transparent',
                color: activeTab === 'admin' ? '#000' : COLORS.textSecondary,
                transition: 'all 0.2s',
              }}
            >
              Admin Demo
            </button>
          </div>

          <button
            onClick={resetDemo}
            style={{
              padding: '8px 16px', border: `1px solid ${COLORS.border}`, borderRadius: 6,
              background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer', fontSize: 13,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.error; e.currentTarget.style.color = COLORS.error; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textSecondary; }}
          >
            Reset Demo
          </button>
        </div>
      </div>

      {/* Account Balances Bar */}
      <div style={{ padding: '16px 32px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', gap: 16, overflowX: 'auto' }}>
        {accounts.map(account => (
          <motion.div
            key={account.address}
            layout
            style={{
              flex: '1 1 0',
              minWidth: 200,
              padding: '12px 16px',
              background: COLORS.surface,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent }}>{account.label}</span>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{account.role}</span>
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontFamily: 'monospace' }}>{account.address}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <motion.div
                key={account.balances.USDT}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3 }}
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                {account.balances.USDT.toLocaleString()} <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>USDT</span>
              </motion.div>
              <motion.div
                key={account.balances.KRW}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3 }}
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                {account.balances.KRW.toLocaleString()} <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>KRW</span>
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
        {/* Left: Steps */}
        <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'user' ? (
              <motion.div
                key="user"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Steps Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {steps.map((step, idx) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      style={{
                        padding: '20px 24px',
                        background: step.status === 'active' ? COLORS.accentDim : COLORS.surface,
                        borderRadius: 12,
                        border: `1px solid ${step.status === 'active' ? COLORS.accent : step.status === 'completed' ? COLORS.borderActive + '40' : COLORS.border}`,
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s',
                      }}
                    >
                      {step.status === 'active' && (
                        <motion.div
                          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: COLORS.accent }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 1.5 }}
                        />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                          background: step.status === 'completed' ? COLORS.accent : step.status === 'active' ? COLORS.accentDim : COLORS.border,
                          color: step.status === 'completed' ? '#000' : step.status === 'active' ? COLORS.accent : COLORS.textMuted,
                          border: step.status === 'active' ? `2px solid ${COLORS.accent}` : 'none',
                        }}>
                          {step.status === 'completed' ? '✓' : step.id}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: step.status === 'pending' ? COLORS.textSecondary : COLORS.text }}>
                            {step.title}
                          </div>
                          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{step.description}</div>
                        </div>
                        {step.status === 'completed' && (
                          <span style={{ fontSize: 11, color: COLORS.success, fontWeight: 500 }}>DONE</span>
                        )}
                        {step.status === 'active' && (
                          <motion.span
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            style={{ fontSize: 11, color: COLORS.warning, fontWeight: 500 }}
                          >
                            PROCESSING
                          </motion.span>
                        )}
                      </div>

                      {/* Step detail content when active or completed */}
                      {step.status === 'completed' && step.id === 1 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ marginTop: 16, padding: '12px 16px', background: COLORS.bg, borderRadius: 8, fontSize: 12, fontFamily: 'monospace' }}>
                          <div style={{ color: COLORS.textSecondary }}>Pool Data:</div>
                          <div style={{ color: COLORS.text, marginTop: 4 }}>{'{'} type: "SELL", asset: "USDT", amount: 1000,</div>
                          <div style={{ color: COLORS.text }}>  price: 1350 KRW/USDT, total: 1,350,000 KRW,</div>
                          <div style={{ color: COLORS.text }}>  maker: "0xAl...Alice", expiry: "24h" {'}'}</div>
                        </motion.div>
                      )}

                      {step.status === 'completed' && step.id === 3 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ marginTop: 16, padding: '12px 16px', background: COLORS.bg, borderRadius: 8, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                            <span style={{ color: COLORS.textSecondary }}>Alice USDT locked</span>
                            <span style={{ color: COLORS.warning }}>1,000 USDT</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                            <span style={{ color: COLORS.textSecondary }}>Bob deposit locked</span>
                            <span style={{ color: COLORS.warning }}>50 USDT</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                            <span style={{ color: COLORS.textSecondary }}>Platform fee (0.3%)</span>
                            <span style={{ color: COLORS.accent }}>3 USDT</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span style={{ color: COLORS.textSecondary }}>Escrow contract</span>
                            <span style={{ color: COLORS.text, fontFamily: 'monospace' }}>0xEs...crow</span>
                          </div>
                        </motion.div>
                      )}

                      {step.status === 'completed' && step.id === 6 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ marginTop: 16, padding: '12px 16px', background: COLORS.bg, borderRadius: 8, fontSize: 12 }}>
                          <div style={{ color: COLORS.success, fontWeight: 600, marginBottom: 8 }}>Settlement Summary</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                            <span style={{ color: COLORS.textSecondary }}>Bob receives</span>
                            <span style={{ color: COLORS.success }}>997 USDT</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                            <span style={{ color: COLORS.textSecondary }}>Trading fee</span>
                            <span style={{ color: COLORS.accent }}>3 USDT</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                            <span style={{ color: COLORS.textSecondary }}>Relay fee</span>
                            <span style={{ color: COLORS.accent }}>5 USDT</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 600 }}>
                            <span style={{ color: COLORS.text }}>Platform total</span>
                            <span style={{ color: COLORS.accent }}>8 USDT</span>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Execute Button */}
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={executeStep}
                    disabled={isAnimating || currentStep >= 7}
                    style={{
                      padding: '14px 40px',
                      background: currentStep >= 7 ? COLORS.border : `linear-gradient(135deg, ${COLORS.accent}, #00ffd5)`,
                      color: currentStep >= 7 ? COLORS.textMuted : '#000',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: isAnimating || currentStep >= 7 ? 'not-allowed' : 'pointer',
                      opacity: isAnimating ? 0.6 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {currentStep >= 7 ? 'Demo Complete' : isAnimating ? 'Processing...' : `Execute Step ${currentStep + 1} of 7`}
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Admin Demo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Fee Configuration */}
                  <div style={{ padding: 24, background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Fee Configuration</h3>
                    <div style={{ display: 'flex', gap: 24 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 6 }}>Trading Fee Rate (%)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="range"
                            min="0.1"
                            max="2"
                            step="0.1"
                            value={feeRate}
                            onChange={e => { setFeeRate(parseFloat(e.target.value)); addLog(`Admin: Fee rate updated to ${e.target.value}%`, 'warning'); }}
                            style={{ flex: 1, accentColor: COLORS.accent }}
                          />
                          <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent, minWidth: 50 }}>{feeRate}%</span>
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 6 }}>Relay Fee (USDT)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="range"
                            min="1"
                            max="20"
                            step="1"
                            value={relayFee}
                            onChange={e => { setRelayFee(parseInt(e.target.value)); addLog(`Admin: Relay fee updated to ${e.target.value} USDT`, 'warning'); }}
                            style={{ flex: 1, accentColor: COLORS.accent }}
                          />
                          <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent, minWidth: 50 }}>{relayFee} USDT</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dispute Resolution */}
                  <div style={{ padding: 24, background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Dispute Resolution</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: disputeStatus === 'none' ? COLORS.border : disputeStatus === 'raised' ? 'rgba(245, 166, 35, 0.15)' : 'rgba(0, 201, 167, 0.15)',
                        color: disputeStatus === 'none' ? COLORS.textMuted : disputeStatus === 'raised' ? COLORS.warning : COLORS.success,
                      }}>
                        {disputeStatus === 'none' ? 'NO ACTIVE DISPUTES' : disputeStatus === 'raised' ? 'DISPUTE ACTIVE' : 'DISPUTE RESOLVED'}
                      </div>
                      {disputeStatus === 'none' && (
                        <button
                          onClick={() => { setDisputeStatus('raised'); addLog('DISPUTE: Bob raised dispute - "KRW not received"', 'error'); }}
                          style={{ padding: '8px 16px', background: 'rgba(255, 71, 87, 0.15)', color: COLORS.error, border: `1px solid ${COLORS.error}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >
                          Simulate Dispute
                        </button>
                      )}
                      {disputeStatus === 'raised' && (
                        <button
                          onClick={() => { setDisputeStatus('resolved'); addLog('ADMIN: Dispute resolved - funds released to Bob', 'success'); }}
                          style={{ padding: '8px 16px', background: 'rgba(0, 201, 167, 0.15)', color: COLORS.success, border: `1px solid ${COLORS.success}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >
                          Resolve (Release to Bob)
                        </button>
                      )}
                    </div>
                    {disputeStatus === 'raised' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ marginTop: 16, padding: 16, background: COLORS.bg, borderRadius: 8, border: `1px solid rgba(255, 71, 87, 0.3)` }}
                      >
                        <div style={{ fontSize: 13, color: COLORS.error, fontWeight: 600, marginBottom: 8 }}>Dispute Details</div>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Trade ID: 0x7f3a...e2c1</div>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Raised by: Bob (0xBo...Bob)</div>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Reason: Fiat payment not confirmed by seller</div>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Escrow amount: 1,000 USDT</div>
                      </motion.div>
                    )}
                  </div>

                  {/* Emergency Pause */}
                  <div style={{ padding: 24, background: COLORS.surface, borderRadius: 12, border: `1px solid ${isPaused ? COLORS.error : COLORS.border}` }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Emergency Controls</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, color: COLORS.text }}>Platform Trading Status</div>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                          {isPaused ? 'All trading is HALTED. No new pools or trades can be created.' : 'Platform is operating normally.'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsPaused(!isPaused);
                          addLog(isPaused ? 'ADMIN: Platform RESUMED - trading active' : 'ADMIN: EMERGENCY PAUSE activated - all trading halted', isPaused ? 'success' : 'error');
                        }}
                        style={{
                          padding: '10px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          background: isPaused ? COLORS.success : COLORS.error,
                          color: '#fff',
                        }}
                      >
                        {isPaused ? 'Resume Platform' : 'Emergency Pause'}
                      </button>
                    </div>
                    {isPaused && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{ marginTop: 16, padding: '8px 16px', background: 'rgba(255, 71, 87, 0.1)', borderRadius: 6, textAlign: 'center', fontSize: 13, color: COLORS.error, fontWeight: 600 }}
                      >
                        PLATFORM PAUSED - ALL OPERATIONS SUSPENDED
                      </motion.div>
                    )}
                  </div>

                  {/* Revenue Dashboard */}
                  <div style={{ padding: 24, background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Revenue Dashboard</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      <div style={{ padding: 16, background: COLORS.bg, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.accent }}>{accounts.find(a => a.label === 'Fee Wallet')!.balances.USDT} USDT</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Total Collected</div>
                      </div>
                      <div style={{ padding: 16, background: COLORS.bg, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.accent }}>{currentStep >= 7 ? '1' : '0'}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Trades Completed</div>
                      </div>
                      <div style={{ padding: 16, background: COLORS.bg, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.accent }}>{feeRate + relayFee} USDT</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Avg Revenue/Trade</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Transaction Log */}
        <div style={{ width: 420, borderLeft: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary }}>Transaction Log</span>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>{logs.length} entries</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11, lineHeight: 1.7, background: '#050505' }}>
            {logs.length === 0 && (
              <div style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40 }}>
                Click "Execute Step" to begin the trading simulation...
              </div>
            )}
            <AnimatePresence>
              {logs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', gap: 8, marginBottom: 2 }}
                >
                  <span style={{ color: COLORS.textMuted, flexShrink: 0 }}>{log.timestamp}</span>
                  <span style={{
                    color: log.type === 'success' ? COLORS.success :
                           log.type === 'warning' ? COLORS.warning :
                           log.type === 'error' ? COLORS.error :
                           COLORS.info,
                  }}>
                    {log.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
