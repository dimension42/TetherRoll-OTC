'use client';

import { tokensFor, type TokenInfo } from '@/lib/tokens';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

/**
 * 토큰 선택 드롭다운. 체인 ID 기반 화이트리스트 필터링.
 */
export function TokenSelect({
  chainId,
  value,
  onChange,
  disabled = false,
}: {
  chainId: number | null;
  value: string | null;
  onChange: (token: TokenInfo) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tokens = chainId ? tokensFor(chainId) : [];
  const selected = value ? tokens.find(t => t.address.toLowerCase() === value.toLowerCase()) : null;

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
          {selected ? `${selected.symbol} — ${selected.name}` : 'Select token...'}
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: '#666' }} />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-2 left-0 right-0 rounded-xl p-2 max-h-64 overflow-y-auto z-50"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}
          >
            {tokens.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: '#666' }}>
                No tokens available
              </p>
            ) : (
              tokens.map(token => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => {
                    onChange(token);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left transition-all hover:bg-white/5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{token.symbol}</p>
                    <p className="text-xs" style={{ color: '#666' }}>
                      {token.name}
                    </p>
                  </div>
                  {selected?.address.toLowerCase() === token.address.toLowerCase() && (
                    <span style={{ color: '#00c9a7' }}>✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
