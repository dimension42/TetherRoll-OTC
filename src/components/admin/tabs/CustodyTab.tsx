'use client';

import { useState } from 'react';
import AssetsSection from '../custody/AssetsSection';
import DepositsSection from '../custody/DepositsSection';
import PayoutsSection from '../custody/PayoutsSection';
import BalancesSection from '../custody/BalancesSection';
import TradesSection from '../custody/TradesSection';

type SubTab = 'assets' | 'deposits' | 'payouts' | 'balances' | 'trades';

export default function CustodyTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('assets');

  const subTabs: { key: SubTab; label: string; icon: string }[] = [
    { key: 'assets', label: 'Assets', icon: '💎' },
    { key: 'deposits', label: 'Deposits', icon: '📥' },
    { key: 'payouts', label: 'Payouts', icon: '📤' },
    { key: 'balances', label: 'Balances', icon: '⚖️' },
    { key: 'trades', label: 'Trades', icon: '🔄' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Custody (Platform Escrow)</h1>

      {/* Sub-tab navigation */}
      <div className="flex gap-2 mb-6">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            style={{
              background: activeSubTab === tab.key ? '#00c9a7' : '#111',
              color: activeSubTab === tab.key ? '#050806' : '#8FA398',
              border: `1px solid ${activeSubTab === tab.key ? '#00c9a7' : '#1f1f1f'}`,
            }}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === 'assets' && <AssetsSection />}
      {activeSubTab === 'deposits' && <DepositsSection />}
      {activeSubTab === 'payouts' && <PayoutsSection />}
      {activeSubTab === 'balances' && <BalancesSection />}
      {activeSubTab === 'trades' && <TradesSection />}
    </div>
  );
}
