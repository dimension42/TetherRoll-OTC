'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage } from '../ui';

interface Balance {
  asset: {
    id: string;
    symbol: string;
    chain_key: string;
    chain_name: string;
    decimals: number;
    deposit_address: string;
  };
  dbHeld: string;
  pendingPayouts: string;
  onchainBalance: string | null;
  diff: string | null;
}

export default function BalancesSection() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBalances = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ balances: Balance[] }>('/api/admin/custody/balances');
      setBalances(data.balances);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  const formatAmount = (amount: string, decimals: number) => {
    const num = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    const frac = num % divisor;
    return `${whole.toLocaleString()}.${frac.toString().padStart(decimals, '0')}`;
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadBalances} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Balance Reconciliation</h2>
        <button
          onClick={loadBalances}
          className="px-4 py-2 rounded-lg text-sm font-bold"
          style={{ background: '#00c9a7', color: '#050806' }}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="mb-4 p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <p className="text-xs" style={{ color: '#8FA398' }}>
          <span className="font-bold" style={{ color: '#fff' }}>DB Held:</span> Sum of CONFIRMED legs not yet paid out<br />
          <span className="font-bold" style={{ color: '#fff' }}>Pending Payouts:</span> Sum of REQUESTED + APPROVED payouts<br />
          <span className="font-bold" style={{ color: '#fff' }}>On-Chain Balance:</span> Actual balance on the deposit address (via verifier)<br />
          <span className="font-bold" style={{ color: '#fff' }}>Diff:</span> On-Chain − DB Held − Pending Payouts (should be &ge; 0)
        </p>
      </div>

      <DataTable
        columns={[
          { key: 'asset', label: 'Asset', render: b => `${b.asset.symbol} (${b.asset.chain_key})` },
          { key: 'address', label: 'Deposit Address', render: b => <span className="font-mono text-xs">{b.asset.deposit_address.slice(0, 20)}...</span> },
          { key: 'dbHeld', label: 'DB Held', render: b => formatAmount(b.dbHeld, b.asset.decimals), mono: true },
          { key: 'pending', label: 'Pending Payouts', render: b => formatAmount(b.pendingPayouts, b.asset.decimals), mono: true },
          {
            key: 'onchain',
            label: 'On-Chain',
            render: b => b.onchainBalance !== null ? formatAmount(b.onchainBalance, b.asset.decimals) : '—',
            mono: true,
          },
          {
            key: 'diff',
            label: 'Diff',
            render: b => {
              if (b.diff === null) return <span style={{ color: '#8FA398' }}>—</span>;
              const diffNum = BigInt(b.diff);
              const color = diffNum < 0 ? '#FF4D5E' : diffNum > 0 ? '#00c9a7' : '#8FA398';
              return <span style={{ color, fontWeight: 'bold' }}>{formatAmount(b.diff, b.asset.decimals)}</span>;
            },
            mono: true,
          },
        ]}
        data={balances}
        keyExtractor={b => b.asset.id}
        emptyText="No enabled assets"
      />

      {balances.some(b => b.diff !== null && BigInt(b.diff) < 0) && (
        <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid #FF4D5E40' }}>
          <p className="text-sm font-bold mb-2" style={{ color: '#FF4D5E' }}>⚠️ Negative Difference Detected</p>
          <p className="text-xs" style={{ color: '#FF4D5E' }}>
            One or more assets have a negative difference, meaning the platform owes more than what&apos;s on-chain.
            Investigate immediately: check for missed deposits or unauthorized withdrawals.
          </p>
        </div>
      )}
    </div>
  );
}
