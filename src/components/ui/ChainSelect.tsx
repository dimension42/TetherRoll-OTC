'use client';

import { SUPPORTED_CHAINS, CHAIN_META } from '@/lib/chains';
import { isChainDeployed } from '@/lib/contracts/addresses';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { type Chain } from 'viem/chains';

/**
 * 체인 선택 드롭다운. 배포된 체인만 또는 전체.
 */
export function ChainSelect({
  value,
  onChange,
  onlyDeployed = true,
  disabled = false,
}: {
  value: number | null;
  onChange: (chain: Chain) => void;
  onlyDeployed?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const chains = onlyDeployed ? SUPPORTED_CHAINS.filter(c => isChainDeployed(c.id)) : SUPPORTED_CHAINS;
  const selected = value ? chains.find(c => c.id === value) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="input-dark flex items-center justify-between"
        style={{
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span className={selected ? 'text-white' : 'text-gray-500'}>
          {selected ? CHAIN_META[selected.id]?.name || selected.name : 'Select chain...'}
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: '#666' }} />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-2 left-0 right-0 rounded-xl p-2 z-50"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}
          >
            {chains.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: '#666' }}>
                No chains available
              </p>
            ) : (
              chains.map(chain => {
                const meta = CHAIN_META[chain.id];
                return (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => {
                      onChange(chain);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left transition-all hover:bg-white/5 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{meta?.name || chain.name}</p>
                      <p className="text-xs" style={{ color: '#666' }}>
                        {meta?.testnet ? 'Testnet' : 'Mainnet'}
                      </p>
                    </div>
                    {selected?.id === chain.id && <span style={{ color: '#00c9a7' }}>✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
