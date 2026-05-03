'use client';

import { useState, useCallback, useEffect } from 'react';
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

// ─── Modal Components ────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '85vh',
          background: '#0d0d0d',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function ModalHeader({ title, subtitle, actor }: { title: string; subtitle?: string; actor?: string }) {
  return (
    <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {actor && (
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          {actor}
        </div>
      )}
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>{title}</h2>
      {subtitle && <p style={{ margin: '6px 0 0', fontSize: 13, color: COLORS.textSecondary }}>{subtitle}</p>}
    </div>
  );
}

function ModalBody({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '20px 28px', flex: 1, overflowY: 'auto' }}>{children}</div>;
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 28px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, loading }: { children: React.ReactNode; onClick: () => void; loading?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '12px 28px', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
        background: 'linear-gradient(135deg, #00c9a7, #00a88a)',
        color: '#000', fontSize: 14, fontWeight: 700,
        opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
      }}
    >
      {loading ? 'Processing...' : children}
    </motion.button>
  );
}

function FormField({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <div style={{
        padding: '12px 16px', borderRadius: 10,
        background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: disabled ? COLORS.textSecondary : '#fff', fontSize: 14,
      }}>
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? COLORS.accent : '#fff' }}>{value}</span>
    </div>
  );
}

// Step 1: Pool Creation Modal
function PoolCreationModal({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'form' | 'submitting' | 'done'>('form');

  const handleSubmit = async () => {
    setPhase('submitting');
    await new Promise(r => setTimeout(r, 1800));
    setPhase('done');
  };

  return (
    <ModalOverlay>
      <ModalHeader title="Create Sell Pool" subtitle="List your USDT for sale at a fixed KRW rate" actor="Alice (Maker)" />
      <ModalBody>
        {phase === 'form' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>Token</label>
                <div style={{
                  padding: '12px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.2)',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#26a17b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>T</div>
                  <span style={{ color: '#fff', fontWeight: 600 }}>USDT</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>Type</label>
                <div style={{
                  padding: '12px 16px', borderRadius: 10, textAlign: 'center',
                  background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.2)',
                  color: '#ff4466', fontWeight: 600, fontSize: 14,
                }}>
                  SELL
                </div>
              </div>
            </div>
            <FormField label="Amount" value="1,000 USDT" />
            <FormField label="Price per USDT" value="1,350 KRW" />
            <FormField label="Total" value="1,350,000 KRW" />
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(0,201,167,0.06)', border: '1px solid rgba(0,201,167,0.12)', marginTop: 8 }}>
              <div style={{ fontSize: 12, color: COLORS.accent, fontWeight: 500 }}>Pool expires in 24 hours</div>
              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Platform fee: 0.3% (3 USDT) deducted at settlement</div>
            </div>
          </motion.div>
        )}
        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 48, height: 48, border: '3px solid rgba(0,201,167,0.2)', borderTopColor: COLORS.accent, borderRadius: '50%', margin: '0 auto 20px' }}
            />
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Submitting Pool to Blockchain...</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>Awaiting transaction confirmation</p>
            <div style={{ marginTop: 20, padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontFamily: 'monospace', fontSize: 11, color: COLORS.textMuted }}>
              TX: 0x7f3a8b2c...pending
            </div>
          </motion.div>
        )}
        {phase === 'done' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200 }}
              style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,201,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}
            >
              <span style={{ fontSize: 28, color: COLORS.accent }}>&#10003;</span>
            </motion.div>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Pool Created Successfully</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>Your sell offer is now live</p>
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'left' }}>
              <InfoRow label="Pool ID" value="0x7f3a...e2c1" highlight />
              <InfoRow label="Amount" value="1,000 USDT" />
              <InfoRow label="Rate" value="1,350 KRW/USDT" />
              <InfoRow label="Status" value="ACTIVE" highlight />
            </div>
          </motion.div>
        )}
      </ModalBody>
      <ModalFooter>
        {phase === 'form' && <PrimaryButton onClick={handleSubmit}>Register Pool</PrimaryButton>}
        {phase === 'done' && <PrimaryButton onClick={onComplete}>Continue</PrimaryButton>}
      </ModalFooter>
    </ModalOverlay>
  );
}

// Step 2: Pool Matching Modal
function PoolMatchingModal({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'browse' | 'confirming' | 'matched'>('browse');

  const handleAccept = async () => {
    setPhase('confirming');
    await new Promise(r => setTimeout(r, 1500));
    setPhase('matched');
  };

  return (
    <ModalOverlay>
      <ModalHeader title="Available Pools" subtitle="Browse and accept OTC trade offers" actor="Bob (Taker)" />
      <ModalBody>
        {phase === 'browse' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Pool Card */}
            <div style={{
              padding: 20, borderRadius: 14,
              background: 'rgba(0,201,167,0.04)',
              border: '1px solid rgba(0,201,167,0.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#26a17b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>T</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>SELL 1,000 USDT</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>by Alice (0xAl...Alice)</div>
                  </div>
                </div>
                <div style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(0,201,167,0.12)', color: COLORS.accent, fontSize: 11, fontWeight: 600 }}>ACTIVE</div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <InfoRow label="Rate" value="1,350 KRW / USDT" />
                <InfoRow label="Total Cost" value="1,350,000 KRW" highlight />
                <InfoRow label="Security Deposit" value="50 USDT" />
                <InfoRow label="Expires" value="23h 42m" />
              </div>
            </div>

            {/* Other pools (dimmed) */}
            <div style={{ marginTop: 12, opacity: 0.4, padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>T</div>
                <div>
                  <div style={{ fontSize: 13, color: '#888' }}>SELL 500 USDT @ 1,360 KRW</div>
                  <div style={{ fontSize: 11, color: '#555' }}>by 0x8c...3f21</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, opacity: 0.3, padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>T</div>
                <div>
                  <div style={{ fontSize: 13, color: '#888' }}>SELL 2,000 USDT @ 1,340 KRW</div>
                  <div style={{ fontSize: 11, color: '#555' }}>by 0x4b...a912</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {phase === 'confirming' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 48, height: 48, border: '3px solid rgba(0,201,167,0.2)', borderTopColor: COLORS.accent, borderRadius: '50%', margin: '0 auto 20px' }}
            />
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Matching Trade...</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>Locking your acceptance on-chain</p>
          </motion.div>
        )}
        {phase === 'matched' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '32px 0' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,201,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}
            >
              <span style={{ fontSize: 28, color: COLORS.accent }}>&#10003;</span>
            </motion.div>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Trade Matched</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>You are now paired with Alice</p>
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'left' }}>
              <InfoRow label="Your role" value="Buyer (Taker)" />
              <InfoRow label="Counterparty" value="Alice (Maker)" />
              <InfoRow label="You pay" value="1,350,000 KRW" />
              <InfoRow label="You receive" value="~997 USDT" highlight />
            </div>
          </motion.div>
        )}
      </ModalBody>
      <ModalFooter>
        {phase === 'browse' && <PrimaryButton onClick={handleAccept}>Accept Trade</PrimaryButton>}
        {phase === 'matched' && <PrimaryButton onClick={onComplete}>Continue</PrimaryButton>}
      </ModalFooter>
    </ModalOverlay>
  );
}

// Step 3: Escrow Creation Modal
function EscrowCreationModal({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'preview' | 'locking' | 'locked'>('preview');

  const handleLock = async () => {
    setPhase('locking');
    await new Promise(r => setTimeout(r, 2200));
    setPhase('locked');
  };

  return (
    <ModalOverlay>
      <ModalHeader title="Escrow Vault" subtitle="Smart contract secures funds for both parties" actor="System" />
      <ModalBody>
        {phase === 'preview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,201,167,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>A</span>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Alice</span>
                </div>
                <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ fontSize: 20, color: COLORS.textMuted }}>→</motion.div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,170,0,0.1)', border: '2px solid rgba(255,170,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                    <span style={{ fontSize: 20 }}>&#128274;</span>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.warning }}>Escrow</span>
                </div>
                <motion.div animate={{ x: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ fontSize: 20, color: COLORS.textMuted }}>←</motion.div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>B</span>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Bob</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Funds to Lock</div>
              <InfoRow label="Alice deposits" value="1,000 USDT" />
              <InfoRow label="Bob security deposit" value="50 USDT" />
              <InfoRow label="Platform fee (0.3%)" value="3 USDT" highlight />
              <InfoRow label="Relay fee" value="5 USDT" highlight />
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.15)' }}>
                <span style={{ fontSize: 12, color: COLORS.warning }}>Total locked in escrow: 1,050 USDT</span>
              </div>
            </div>
          </motion.div>
        )}
        {phase === 'locking' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '30px 0' }}>
            <motion.div
              animate={{ scale: [1, 1.1, 1], borderColor: ['rgba(255,170,0,0.3)', 'rgba(255,170,0,0.8)', 'rgba(255,170,0,0.3)'] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ width: 72, height: 72, borderRadius: 18, border: '3px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', background: 'rgba(255,170,0,0.05)' }}
            >
              <span style={{ fontSize: 32 }}>&#128274;</span>
            </motion.div>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Locking Funds in Escrow...</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>Deploying escrow smart contract</p>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', padding: '0 20px' }}>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} style={{ fontSize: 12, color: COLORS.success }}>&#10003; Alice USDT transferred to vault</motion.div>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} style={{ fontSize: 12, color: COLORS.success }}>&#10003; Bob deposit locked</motion.div>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 }} style={{ fontSize: 12, color: COLORS.warning }}>&#9679; Finalizing contract...</motion.div>
            </div>
          </motion.div>
        )}
        {phase === 'locked' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '30px 0' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,201,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}
            >
              <span style={{ fontSize: 28, color: COLORS.accent }}>&#128274;</span>
            </motion.div>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Escrow Locked</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 6 }}>Funds secured. Awaiting fiat payment.</p>
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'left' }}>
              <InfoRow label="Contract" value="0xEs...crow" highlight />
              <InfoRow label="Alice locked" value="1,000 USDT" />
              <InfoRow label="Bob locked" value="50 USDT" />
              <InfoRow label="Status" value="AWAITING FIAT" highlight />
            </div>
          </motion.div>
        )}
      </ModalBody>
      <ModalFooter>
        {phase === 'preview' && <PrimaryButton onClick={handleLock}>Lock Escrow</PrimaryButton>}
        {phase === 'locked' && <PrimaryButton onClick={onComplete}>Continue</PrimaryButton>}
      </ModalFooter>
    </ModalOverlay>
  );
}

// Step 4: Fiat Transfer Modal
function FiatTransferModal({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'form' | 'sending' | 'confirmed'>('form');

  const handleSend = async () => {
    setPhase('sending');
    await new Promise(r => setTimeout(r, 2500));
    setPhase('confirmed');
  };

  return (
    <ModalOverlay>
      <ModalHeader title="Send KRW Payment" subtitle="Transfer fiat to the seller's bank account" actor="Bob (Taker)" />
      <ModalBody>
        {phase === 'form' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginBottom: 8 }}>Recipient Bank Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Bank</span>
                  <span style={{ fontSize: 12, color: '#fff' }}>Kookmin Bank (KB)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Account</span>
                  <span style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>***-***-4821</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Holder</span>
                  <span style={{ fontSize: 12, color: '#fff' }}>Alice K.</span>
                </div>
              </div>
            </div>

            <FormField label="Amount to Send" value="1,350,000 KRW" />
            <FormField label="Reference / Memo" value="TR-0x7f3a-BOB" disabled />

            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.12)', marginTop: 8 }}>
              <div style={{ fontSize: 12, color: COLORS.warning }}>Ensure you use the exact reference code above so the seller can verify your payment.</div>
            </div>
          </motion.div>
        )}
        {phase === 'sending' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ fontSize: 48, margin: '0 auto 24px' }}
            >
              &#128184;
            </motion.div>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Processing Bank Transfer...</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>1,350,000 KRW to Kookmin Bank</p>
            <motion.div
              style={{ marginTop: 24, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.2, ease: 'easeInOut' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #00c9a7)', borderRadius: 2 }}
              />
            </motion.div>
          </motion.div>
        )}
        {phase === 'confirmed' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '30px 0' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,201,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}
            >
              <span style={{ fontSize: 28, color: COLORS.accent }}>&#10003;</span>
            </motion.div>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Payment Sent</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 6 }}>Bank transfer confirmed</p>
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'left' }}>
              <InfoRow label="Amount" value="1,350,000 KRW" />
              <InfoRow label="Reference" value="KRW-2026-0503-7821" highlight />
              <InfoRow label="Status" value="CONFIRMED" highlight />
            </div>
          </motion.div>
        )}
      </ModalBody>
      <ModalFooter>
        {phase === 'form' && <PrimaryButton onClick={handleSend}>Confirm Transfer</PrimaryButton>}
        {phase === 'confirmed' && <PrimaryButton onClick={onComplete}>Continue</PrimaryButton>}
      </ModalFooter>
    </ModalOverlay>
  );
}

// Step 5: Delivery Confirmation Modal
function DeliveryConfirmModal({ onComplete }: { onComplete: () => void }) {
  const [aliceConfirmed, setAliceConfirmed] = useState(false);
  const [bobConfirmed, setBobConfirmed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setAliceConfirmed(true), 1200);
    const t2 = setTimeout(() => setBobConfirmed(true), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const bothConfirmed = aliceConfirmed && bobConfirmed;

  return (
    <ModalOverlay>
      <ModalHeader title="Delivery Confirmation" subtitle="Both parties must confirm to release escrow" actor="System" />
      <ModalBody>
        <div style={{ padding: '20px 0' }}>
          {/* Alice confirmation */}
          <motion.div
            animate={{ borderColor: aliceConfirmed ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.06)' }}
            style={{ padding: 20, borderRadius: 14, border: '1px solid', marginBottom: 16, background: aliceConfirmed ? 'rgba(0,201,167,0.04)' : 'rgba(255,255,255,0.02)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,201,167,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>A</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Alice (Seller)</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>Confirming KRW payment received</div>
              </div>
              {aliceConfirmed ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#000', fontWeight: 700 }}>&#10003;</span>
                </motion.div>
              ) : (
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ fontSize: 12, color: COLORS.warning }}>Pending...</motion.div>
              )}
            </div>
          </motion.div>

          {/* Bob confirmation */}
          <motion.div
            animate={{ borderColor: bobConfirmed ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.06)' }}
            style={{ padding: 20, borderRadius: 14, border: '1px solid', background: bobConfirmed ? 'rgba(0,201,167,0.04)' : 'rgba(255,255,255,0.02)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>B</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Bob (Buyer)</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>Confirming ready for USDT release</div>
              </div>
              {bobConfirmed ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#000', fontWeight: 700 }}>&#10003;</span>
                </motion.div>
              ) : (
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ fontSize: 12, color: COLORS.warning }}>Pending...</motion.div>
              )}
            </div>
          </motion.div>

          {/* Both confirmed message */}
          <AnimatePresence>
            {bothConfirmed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.2)', textAlign: 'center' }}
              >
                <p style={{ color: COLORS.accent, fontSize: 14, fontWeight: 700, margin: 0 }}>Both Parties Confirmed</p>
                <p style={{ color: COLORS.textSecondary, fontSize: 12, margin: '4px 0 0' }}>Escrow settlement will begin now</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ModalBody>
      <ModalFooter>
        {bothConfirmed && <PrimaryButton onClick={onComplete}>Proceed to Settlement</PrimaryButton>}
      </ModalFooter>
    </ModalOverlay>
  );
}

// Step 6: Settlement Modal
function SettlementModal({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'preview' | 'settling' | 'done'>('preview');

  const handleSettle = async () => {
    setPhase('settling');
    await new Promise(r => setTimeout(r, 2500));
    setPhase('done');
  };

  return (
    <ModalOverlay>
      <ModalHeader title="Settlement" subtitle="Escrow releases funds to all parties" actor="Smart Contract" />
      <ModalBody>
        {phase === 'preview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>The following distribution will occur:</div>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>From Escrow Vault (1,050 USDT)</div>
              <InfoRow label="Bob receives (trade)" value="997 USDT" highlight />
              <InfoRow label="Bob deposit returned" value="50 USDT" />
              <InfoRow label="Platform trading fee" value="3 USDT" highlight />
              <InfoRow label="Platform relay fee" value="5 USDT" highlight />
              <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, background: 'rgba(0,201,167,0.06)', border: '1px solid rgba(0,201,167,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>Total Platform Revenue</span>
                  <span style={{ fontSize: 15, color: COLORS.accent, fontWeight: 700 }}>8 USDT</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {phase === 'settling' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '20px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ width: 48, height: 48, border: '3px solid rgba(0,201,167,0.2)', borderTopColor: COLORS.accent, borderRadius: '50%', margin: '0 auto 16px' }}
              />
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Settling Escrow...</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,201,167,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>997 USDT → Bob</span>
                <span style={{ fontSize: 11, color: COLORS.success }}>&#10003;</span>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }}
                style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,201,167,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>50 USDT deposit → Bob</span>
                <span style={{ fontSize: 11, color: COLORS.success }}>&#10003;</span>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 }}
                style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,201,167,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>3 USDT fee → Platform</span>
                <span style={{ fontSize: 11, color: COLORS.success }}>&#10003;</span>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.9 }}
                style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,201,167,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>5 USDT relay → Platform</span>
                <span style={{ fontSize: 11, color: COLORS.success }}>&#10003;</span>
              </motion.div>
            </div>
          </motion.div>
        )}
        {phase === 'done' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '30px 0' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(0,201,167,0.2), rgba(0,201,167,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}
            >
              <span style={{ fontSize: 32, color: COLORS.accent }}>&#10003;</span>
            </motion.div>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>Trade Complete</p>
            <p style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 6 }}>All funds distributed successfully</p>
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Bob received</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.accent, marginTop: 4 }}>997 USDT</div>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Alice received</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1', marginTop: 4 }}>1.35M KRW</div>
              </div>
            </div>
          </motion.div>
        )}
      </ModalBody>
      <ModalFooter>
        {phase === 'preview' && <PrimaryButton onClick={handleSettle}>Execute Settlement</PrimaryButton>}
        {phase === 'done' && <PrimaryButton onClick={onComplete}>Continue</PrimaryButton>}
      </ModalFooter>
    </ModalOverlay>
  );
}

// Step 7: Platform Revenue Modal
function RevenueModal({ onComplete }: { onComplete: () => void }) {
  return (
    <ModalOverlay>
      <ModalHeader title="Platform Revenue" subtitle="Cumulative fees collected from this trade" actor="Admin Dashboard" />
      <ModalBody>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Revenue cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              style={{ padding: 16, borderRadius: 12, background: 'rgba(0,201,167,0.06)', border: '1px solid rgba(0,201,167,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.accent }}>8</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>USDT Earned</div>
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
              style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>1</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>Trades Done</div>
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
              style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>0</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>Disputes</div>
            </motion.div>
          </div>

          {/* Fee Breakdown */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Revenue Breakdown</div>
            <InfoRow label="Trading fee (0.3%)" value="3 USDT" />
            <InfoRow label="Relay fee (flat)" value="5 USDT" />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Total Revenue</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>8 USDT</span>
            </div>
          </div>

          {/* Platform wallet */}
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,201,167,0.04)', border: '1px solid rgba(0,201,167,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Platform Wallet</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: 'monospace', marginTop: 2 }}>0xFe...Platform</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.accent }}>8 USDT</div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Current Balance</div>
              </div>
            </div>
          </div>
        </motion.div>
      </ModalBody>
      <ModalFooter>
        <PrimaryButton onClick={onComplete}>Complete Demo</PrimaryButton>
      </ModalFooter>
    </ModalOverlay>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<StepData[]>(STEPS);
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeModal, setActiveModal] = useState<number | null>(null);

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
    setActiveModal(null);
  };

  const openStep = (stepNum: number) => {
    if (stepNum !== currentStep + 1) return;
    setSteps(prev => prev.map(s => s.id === stepNum ? { ...s, status: 'active' } : s));
    setActiveModal(stepNum);
  };

  const completeStep = (stepNum: number) => {
    setActiveModal(null);
    setSteps(prev => prev.map(s => s.id === stepNum ? { ...s, status: 'completed' } : s));
    setCurrentStep(stepNum);

    switch (stepNum) {
      case 1:
        addLog('Pool created: SELL 1000 USDT @ 1,350 KRW/USDT', 'success');
        addLog('Pool ID: 0x7f3a...e2c1 | Status: ACTIVE', 'info');
        break;
      case 2:
        addLog('Match confirmed: Bob <-> Alice Pool #0x7f3a', 'success');
        addLog('Trade pair locked: 1000 USDT / 1,350,000 KRW', 'info');
        break;
      case 3:
        addLog('Escrow locked: Alice 1000 USDT + Bob 50 USDT', 'warning');
        addLog('Platform fee: 3 USDT | Relay fee: 5 USDT', 'info');
        setAccounts(prev => prev.map(a => {
          if (a.label === 'Alice') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT - 1000 } };
          if (a.label === 'Bob') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT - 50 } };
          return a;
        }));
        break;
      case 4:
        addLog('Bank transfer confirmed: 1,350,000 KRW sent', 'success');
        addLog('Reference: KRW-2026-0503-7821', 'info');
        setAccounts(prev => prev.map(a => {
          if (a.label === 'Bob') return { ...a, balances: { ...a.balances, KRW: a.balances.KRW - 1350000 } };
          if (a.label === 'Alice') return { ...a, balances: { ...a.balances, KRW: a.balances.KRW + 1350000 } };
          return a;
        }));
        break;
      case 5:
        addLog('[CONFIRMED] Alice: KRW received', 'success');
        addLog('[CONFIRMED] Bob: Ready for release', 'success');
        break;
      case 6:
        addLog('Settlement complete: Bob receives 997 USDT', 'success');
        addLog('Platform revenue: 8 USDT (3 fee + 5 relay)', 'success');
        setAccounts(prev => prev.map(a => {
          if (a.label === 'Bob') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT + 997 + 50 } };
          if (a.label === 'Fee Wallet') return { ...a, balances: { ...a.balances, USDT: a.balances.USDT + 8 } };
          return a;
        }));
        break;
      case 7:
        addLog('=== TRADE COMPLETE === Total platform revenue: 8 USDT', 'success');
        break;
    }
  };

  const progressPercent = (currentStep / 7) * 100;

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
            Interactive Simulation
          </span>
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

      {/* Account Balances Bar */}
      <div style={{ padding: '16px 32px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', gap: 16, overflowX: 'auto' }}>
        {accounts.map(account => (
          <motion.div
            key={account.address}
            layout
            style={{
              flex: '1 1 0', minWidth: 200, padding: '12px 16px',
              background: COLORS.surface, borderRadius: 8, border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent }}>{account.label}</span>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>{account.role}</span>
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontFamily: 'monospace' }}>{account.address}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <motion.div key={account.balances.USDT} initial={{ scale: 1 }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.3 }} style={{ fontSize: 14, fontWeight: 600 }}>
                {account.balances.USDT.toLocaleString()} <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>USDT</span>
              </motion.div>
              <motion.div key={account.balances.KRW} initial={{ scale: 1 }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.3 }} style={{ fontSize: 14, fontWeight: 600 }}>
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
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: COLORS.textSecondary, margin: 0 }}>
              Click each step to open the simulated UI screen. Complete steps in order.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((step, idx) => {
              const isNext = step.id === currentStep + 1;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => isNext && openStep(step.id)}
                  style={{
                    padding: '20px 24px',
                    background: step.status === 'active' ? COLORS.accentDim : isNext ? COLORS.surfaceHover : COLORS.surface,
                    borderRadius: 12,
                    border: `1px solid ${step.status === 'completed' ? COLORS.borderActive + '40' : isNext ? COLORS.accent : COLORS.border}`,
                    cursor: isNext ? 'pointer' : 'default',
                    transition: 'all 0.3s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isNext && (
                    <motion.div
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      style={{ position: 'absolute', inset: 0, borderRadius: 12, border: `1px solid ${COLORS.accent}`, pointerEvents: 'none' }}
                    />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700,
                      background: step.status === 'completed' ? COLORS.accent : isNext ? COLORS.accentDim : COLORS.border,
                      color: step.status === 'completed' ? '#000' : isNext ? COLORS.accent : COLORS.textMuted,
                      border: isNext ? `2px solid ${COLORS.accent}` : 'none',
                    }}>
                      {step.status === 'completed' ? '✓' : step.id}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: step.status === 'pending' && !isNext ? COLORS.textSecondary : COLORS.text }}>
                        {step.title}
                      </div>
                      <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{step.description}</div>
                    </div>
                    {step.status === 'completed' && (
                      <span style={{ fontSize: 11, color: COLORS.success, fontWeight: 500 }}>DONE</span>
                    )}
                    {isNext && (
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        style={{ fontSize: 18, color: COLORS.accent }}
                      >
                        →
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {currentStep >= 7 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 24, padding: 24, borderRadius: 14, background: 'rgba(0,201,167,0.06)', border: '1px solid rgba(0,201,167,0.2)', textAlign: 'center' }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>&#127881;</div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Demo Complete</p>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 6 }}>
                Full OTC trade lifecycle simulated: Pool → Match → Escrow → Fiat → Confirm → Settle → Revenue
              </p>
            </motion.div>
          )}
        </div>

        {/* Right: Transaction Log */}
        <div style={{ width: 380, borderLeft: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary }}>Transaction Log</span>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>{logs.length} entries</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11, lineHeight: 1.7, background: '#050505' }}>
            {logs.length === 0 && (
              <div style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40 }}>
                Click a step to open the UI simulation...
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
                           log.type === 'error' ? COLORS.error : COLORS.info,
                  }}>
                    {log.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal === 1 && <PoolCreationModal onComplete={() => completeStep(1)} />}
        {activeModal === 2 && <PoolMatchingModal onComplete={() => completeStep(2)} />}
        {activeModal === 3 && <EscrowCreationModal onComplete={() => completeStep(3)} />}
        {activeModal === 4 && <FiatTransferModal onComplete={() => completeStep(4)} />}
        {activeModal === 5 && <DeliveryConfirmModal onComplete={() => completeStep(5)} />}
        {activeModal === 6 && <SettlementModal onComplete={() => completeStep(6)} />}
        {activeModal === 7 && <RevenueModal onComplete={() => completeStep(7)} />}
      </AnimatePresence>
    </div>
  );
}
