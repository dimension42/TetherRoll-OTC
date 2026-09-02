'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect } from 'react';
import { shortAddr, fmtAmount } from '@/lib/format';
import { CHAIN_META, isSupportedChain } from '@/lib/chains';
import { ChevronDown } from 'lucide-react';

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * 지갑 연결 버튼.
 * RainbowKit 사용 가능하면 RainbowKit, 아니면 기본 UI.
 * 미지원 체인이면 "Switch network" 표시.
 */
export default function ConnectWallet() {
  const [mounted, setMounted] = useState(false);
  const { address, chain, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => setMounted(true), []);

  // SSR 대응 — 마운트 전까지 버튼만 표시
  if (!mounted) {
    return (
      <button className="btn-secondary text-sm py-2 px-4">
        Connect
      </button>
    );
  }

  // RainbowKit이 사용 가능하면 RainbowKit Custom 버튼 사용
  if (WALLETCONNECT_PROJECT_ID) {
    return (
      <ConnectButton.Custom>
        {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          if (!ready) {
            return <button className="btn-secondary text-sm py-2 px-4">Connect</button>;
          }

          if (!connected) {
            return (
              <button onClick={openConnectModal} className="btn-primary text-sm py-2 px-4">
                Connect Wallet
              </button>
            );
          }

          // 미지원 체인
          if (chain.unsupported || !isSupportedChain(chain.id)) {
            return (
              <button onClick={openChainModal} className="btn-danger text-sm py-2 px-4 flex items-center gap-2">
                ⚠ Wrong Network
              </button>
            );
          }

          return (
            <div className="flex items-center gap-2">
              <button
                onClick={openChainModal}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'rgba(0,201,167,0.08)',
                  border: '1px solid rgba(0,201,167,0.2)',
                  color: '#00c9a7',
                }}
              >
                {chain.name}
              </button>
              <button
                onClick={openAccountModal}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f0f0f0',
                }}
              >
                <span className="font-mono">{account.displayName}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          );
        }}
      </ConnectButton.Custom>
    );
  }

  // RainbowKit 없을 때 fallback UI
  if (!isConnected || !address) {
    return (
      <FallbackConnectButton />
    );
  }

  // 연결됨 - 체인 + 주소 표시
  const chainMeta = chain ? CHAIN_META[chain.id] : null;
  const unsupported = !chain || !isSupportedChain(chain.id);

  if (unsupported) {
    return (
      <button
        onClick={() => {
          if (switchChain) switchChain({ chainId: 11155111 }); // Sepolia로 전환
        }}
        className="btn-danger text-sm py-2 px-4 flex items-center gap-2"
      >
        ⚠ Switch Network
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#f0f0f0',
        }}
      >
        <span style={{ color: '#00c9a7' }}>{chainMeta?.short || chain?.name}</span>
        <span className="font-mono">{shortAddr(address)}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-xl p-3 z-50"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}
          >
            <div className="mb-3 pb-3" style={{ borderBottom: '1px solid #1f1f1f' }}>
              <p className="text-xs mb-1" style={{ color: '#666' }}>
                Address
              </p>
              <p className="font-mono text-sm text-white">{shortAddr(address, 10, 8)}</p>
            </div>
            {balance && (
              <div className="mb-3 pb-3" style={{ borderBottom: '1px solid #1f1f1f' }}>
                <p className="text-xs mb-1" style={{ color: '#666' }}>
                  Balance
                </p>
                <p className="font-mono text-sm text-white">
                  {fmtAmount(balance.value, balance.decimals, 4)} {balance.symbol}
                </p>
              </div>
            )}
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-all"
              style={{ background: 'rgba(255,77,94,0.1)', color: '#FF4D5E' }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FallbackConnectButton() {
  const { connectors, connect, isPending } = useConnect();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="btn-primary text-sm py-2 px-4"
        disabled={isPending}
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-48 rounded-xl p-2 z-50"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}
          >
            {connectors.map(connector => (
              <button
                key={connector.id}
                onClick={() => {
                  connect({ connector });
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-all hover:bg-white/5"
                style={{ color: '#f0f0f0' }}
              >
                {connector.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
