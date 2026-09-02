'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * ExactAmount — Large monospace amount display with copy button
 * Used for deposit instructions: user must send EXACTLY this amount (with suffix)
 */
export function ExactAmount({ amount, symbol }: { amount: string; symbol: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(amount);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-5 rounded-xl" style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.2)' }}>
      <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: '#00c9a7' }}>
        Exact Amount (송금해야 할 정확한 금액)
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-3xl font-black font-mono text-white break-all">{amount}</p>
          <p className="text-sm font-semibold mt-1" style={{ color: '#00c9a7' }}>{symbol}</p>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-2"
          style={{
            background: copied ? 'rgba(0,255,136,0.15)' : 'rgba(0,201,167,0.1)',
            border: `1px solid ${copied ? 'rgba(0,255,136,0.3)' : 'rgba(0,201,167,0.2)'}`,
            color: copied ? '#00ff88' : '#00c9a7',
          }}
        >
          {copied ? (
            <>
              <Check size={16} />
              <span className="text-xs font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span className="text-xs font-semibold">Copy</span>
            </>
          )}
        </button>
      </div>
      <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,166,35,0.1)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.2)' }}>
        ⚠️ 정확히 이 금액을 보내세요 (꼬리 숫자 포함). 금액이 다르면 자동 확인이 불가능합니다.
      </p>
    </div>
  );
}
