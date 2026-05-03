'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { DEPOSIT_TOKENS } from '@/lib/privy';

type SelectedChain = { chainId: number; name: string; address: string; decimals: number };

function shortenAddr(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function DepositPage() {
  const { user, authenticated, login, ready, wallets } = useAuth();
  const [selectedToken, setSelectedToken] = useState<typeof DEPOSIT_TOKENS[number]>(DEPOSIT_TOKENS[0]);
  const [selectedChain, setSelectedChain] = useState<SelectedChain>(DEPOSIT_TOKENS[0].chains[0]);
  const [copied, setCopied] = useState(false);

  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy');
  const depositAddress = embeddedWallet?.address || externalWallet?.address || user?.wallet?.address;

  const handleCopy = useCallback(() => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [depositAddress]);

  if (!ready) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center" style={{ background: '#080808' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-12 rounded-3xl max-w-md mx-4"
          style={{ background: '#111', border: '1px solid rgba(0,201,167,0.15)' }}
        >
          <p className="text-5xl mb-4">💳</p>
          <h2 className="text-2xl font-bold text-white mb-2">Sign In to Deposit</h2>
          <p className="text-sm mb-6" style={{ color: '#888' }}>
            Sign in with your email, Google, X, Telegram, or wallet to get your unique deposit address.
          </p>
          <button
            onClick={login}
            className="px-8 py-3 rounded-xl text-sm font-semibold text-black"
            style={{ background: 'linear-gradient(135deg, #00c9a7, #00a88a)' }}
          >
            Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16" style={{ background: '#080808' }}>
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Deposit</h1>
          <p className="mb-8" style={{ color: '#888' }}>
            Send USDT or USDC to your unique platform wallet address below.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: QR + Address */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-6"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Your Deposit Address</h2>

            {/* Warning banner */}
            <div
              className="rounded-xl p-3 mb-5 text-xs leading-relaxed"
              style={{
                background: 'rgba(255,170,0,0.08)',
                border: '1px solid rgba(255,170,0,0.2)',
                color: '#ffaa00',
              }}
            >
              <strong>Important:</strong> Only send <strong>{selectedToken.symbol}</strong> on the <strong>{selectedChain.name}</strong> network.
              Sending other tokens or using the wrong network may result in permanent loss.
            </div>

            {/* QR Code */}
            {depositAddress ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl mb-4">
                  <QRCodeSVG
                    value={depositAddress}
                    size={200}
                    level="H"
                    fgColor="#000000"
                    bgColor="#ffffff"
                  />
                </div>

                {/* Address display */}
                <div
                  className="w-full rounded-xl p-3 flex items-center gap-2"
                  style={{ background: 'rgba(0,201,167,0.06)', border: '1px solid rgba(0,201,167,0.15)' }}
                >
                  <code className="flex-1 text-xs break-all" style={{ color: '#00c9a7' }}>
                    {depositAddress}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: copied ? 'rgba(0,201,167,0.2)' : 'rgba(255,255,255,0.05)',
                      color: copied ? '#00c9a7' : '#aaa',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Wallet type indicator */}
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: embeddedWallet ? '#00c9a7' : '#6366f1' }}
                  />
                  <span className="text-xs" style={{ color: '#666' }}>
                    {embeddedWallet ? 'Platform Wallet (Auto-generated)' : 'External Wallet'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }} />
                <p className="text-sm" style={{ color: '#666' }}>Generating your wallet...</p>
              </div>
            )}
          </motion.div>

          {/* Right: Token & Chain Selection */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Token Selection */}
            <div
              className="rounded-2xl p-6"
              style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h3 className="text-sm font-semibold text-white mb-3">Select Token</h3>
              <div className="grid grid-cols-2 gap-3">
                {DEPOSIT_TOKENS.map(token => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setSelectedToken(token);
                      setSelectedChain(token.chains[0]);
                    }}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{
                      background: selectedToken.symbol === token.symbol ? 'rgba(0,201,167,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedToken.symbol === token.symbol ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white"
                        style={{ background: token.color }}
                      >
                        {token.icon}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{token.symbol}</p>
                        <p className="text-xs" style={{ color: '#666' }}>{token.name}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chain Selection */}
            <div
              className="rounded-2xl p-6"
              style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h3 className="text-sm font-semibold text-white mb-3">Select Network</h3>
              <div className="space-y-2">
                {selectedToken.chains.map(chain => (
                  <button
                    key={chain.chainId}
                    onClick={() => setSelectedChain(chain)}
                    className="w-full p-3 rounded-xl flex items-center justify-between transition-all"
                    style={{
                      background: selectedChain.chainId === chain.chainId ? 'rgba(0,201,167,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedChain.chainId === chain.chainId ? 'rgba(0,201,167,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }}>
                        {chain.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-white">{chain.name}</span>
                    </div>
                    {selectedChain.chainId === chain.chainId && (
                      <div className="w-2 h-2 rounded-full" style={{ background: '#00c9a7' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Contract address info */}
            <div
              className="rounded-2xl p-6"
              style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <h3 className="text-sm font-semibold text-white mb-3">Token Contract</h3>
              <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-xs mb-1" style={{ color: '#666' }}>
                  {selectedToken.symbol} on {selectedChain.name}
                </p>
                <code className="text-xs break-all" style={{ color: '#aaa' }}>
                  {selectedChain.address}
                </code>
              </div>
            </div>

            {/* Deposit tracking explainer */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(0,201,167,0.04)', border: '1px solid rgba(0,201,167,0.12)' }}
            >
              <h4 className="text-sm font-semibold mb-2" style={{ color: '#00c9a7' }}>
                How Deposit Tracking Works
              </h4>
              <ul className="space-y-1.5 text-xs" style={{ color: '#888' }}>
                <li>• Each user has a unique wallet address</li>
                <li>• Deposits to your address are automatically attributed to your account</li>
                <li>• Funds are verified on-chain before crediting your balance</li>
                <li>• No manual confirmation needed — fully automated</li>
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Recent deposits placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 rounded-2xl p-6"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h3 className="text-lg font-semibold text-white mb-4">Recent Deposits</h3>
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: '#555' }}>No deposits yet</p>
            <p className="text-xs mt-1" style={{ color: '#444' }}>
              Deposits will appear here once confirmed on-chain
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
