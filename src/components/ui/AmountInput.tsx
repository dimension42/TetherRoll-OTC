'use client';

import { type ChangeEvent } from 'react';

/**
 * 금액 입력 필드. MAX 버튼 + 잔액 표시.
 */
export function AmountInput({
  value,
  onChange,
  balance,
  decimals = 18,
  symbol,
  placeholder = '0.0',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  balance?: string | null;
  decimals?: number;
  symbol?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // 숫자 + 점만 허용
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      onChange(val);
    }
  };

  const handleMax = () => {
    if (balance) {
      onChange(balance);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {symbol && (
          <span className="text-sm font-medium" style={{ color: '#888' }}>
            {symbol}
          </span>
        )}
        {balance && (
          <button
            type="button"
            onClick={handleMax}
            disabled={disabled}
            className="text-xs font-semibold transition-all"
            style={{ color: disabled ? '#555' : '#00c9a7', cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            Balance: <span className="font-mono">{balance}</span> MAX
          </button>
        )}
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="input-dark font-mono text-lg"
        style={{ opacity: disabled ? 0.5 : 1 }}
      />
    </div>
  );
}
