'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { type BankInfo } from '@/lib/types';
import { fmtKrw } from '@/lib/format';

export function BankInfoCard({ bankInfo, fiatAmount }: { bankInfo: BankInfo; fiatAmount: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 rounded-2xl" style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.2)' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🏦</span>
        <h3 className="text-lg font-bold text-white">Seller Bank Details</h3>
      </div>

      <p className="text-sm mb-6" style={{ color: '#888' }}>
        Send <span className="font-mono font-bold" style={{ color: '#00c9a7' }}>{fmtKrw(fiatAmount)}</span> to the following account:
      </p>

      <div className="space-y-3">
        {/* Bank */}
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div>
            <p className="text-xs mb-1" style={{ color: '#666' }}>Bank</p>
            <p className="font-semibold text-white">{bankInfo.bank}</p>
          </div>
          <button
            onClick={() => copyToClipboard(bankInfo.bank, 'bank')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {copied === 'bank' ? (
              <Check className="w-4 h-4" style={{ color: '#00c9a7' }} />
            ) : (
              <Copy className="w-4 h-4" style={{ color: '#888' }} />
            )}
          </button>
        </div>

        {/* Account Number */}
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div>
            <p className="text-xs mb-1" style={{ color: '#666' }}>Account Number</p>
            <p className="font-mono font-semibold text-white">{bankInfo.account}</p>
          </div>
          <button
            onClick={() => copyToClipboard(bankInfo.account, 'account')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {copied === 'account' ? (
              <Check className="w-4 h-4" style={{ color: '#00c9a7' }} />
            ) : (
              <Copy className="w-4 h-4" style={{ color: '#888' }} />
            )}
          </button>
        </div>

        {/* Holder */}
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div>
            <p className="text-xs mb-1" style={{ color: '#666' }}>Account Holder</p>
            <p className="font-semibold text-white">{bankInfo.holder}</p>
          </div>
          <button
            onClick={() => copyToClipboard(bankInfo.holder, 'holder')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {copied === 'holder' ? (
              <Check className="w-4 h-4" style={{ color: '#00c9a7' }} />
            ) : (
              <Copy className="w-4 h-4" style={{ color: '#888' }} />
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}>
        <p className="text-xs font-semibold" style={{ color: '#f5a623' }}>
          ⚠️ Important: Send exactly {fmtKrw(fiatAmount)}. Do not include any notes or memos in the transfer.
        </p>
      </div>
    </div>
  );
}
