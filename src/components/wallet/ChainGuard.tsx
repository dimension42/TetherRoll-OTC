'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { isChainDeployed } from '@/lib/contracts/addresses';
import { CHAIN_META, SUPPORTED_CHAINS } from '@/lib/chains';
import { type ReactNode } from 'react';

/**
 * 배포된 체인에 연결됐을 때만 children 렌더링.
 * 미배포 체인이면 안내 + 전환 버튼.
 */
export default function ChainGuard({ children }: { children: ReactNode }) {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="p-8 rounded-2xl text-center" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <p className="text-5xl mb-4">🔌</p>
        <h3 className="text-xl font-bold text-white mb-2">Wallet Not Connected</h3>
        <p className="text-sm" style={{ color: '#666' }}>
          Please connect your wallet to continue
        </p>
      </div>
    );
  }

  if (!chain || !isChainDeployed(chain.id)) {
    const deployedChains = SUPPORTED_CHAINS.filter(c => isChainDeployed(c.id));

    return (
      <div className="p-8 rounded-2xl text-center" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <p className="text-5xl mb-4">⚠️</p>
        <h3 className="text-xl font-bold text-white mb-2">Contract Not Deployed</h3>
        <p className="text-sm mb-6" style={{ color: '#666' }}>
          EscrowVault is not deployed on {chain?.name || 'this network'}.
          <br />
          Please switch to a supported network:
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {deployedChains.map(c => (
            <button
              key={c.id}
              onClick={() => switchChain?.({ chainId: c.id })}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: 'rgba(0,201,167,0.1)',
                border: '1px solid rgba(0,201,167,0.2)',
                color: '#00c9a7',
              }}
            >
              {CHAIN_META[c.id]?.name || c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
