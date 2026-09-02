'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { AdminRole } from '@/lib/auth/adminRoles';

import DashboardTab from './tabs/DashboardTab';
import RollsTab from './RollsTab';
import RefundsTab from './RefundsTab';
import PoolsTab from './tabs/PoolsTab';
import TradesTab from './tabs/TradesTab';
import DisputesTab from './tabs/DisputesTab';
import VipTab from './tabs/VipTab';
import TreasuryTab from './tabs/TreasuryTab';
import CustodyTab from './tabs/CustodyTab';
import FeesTab from './tabs/FeesTab';
import UsersTab from './tabs/UsersTab';
import LogsTab from './tabs/LogsTab';
import SettingsTab from './tabs/SettingsTab';

type TabKey =
  | 'dashboard'
  | 'rolls'
  | 'pools'
  | 'trades'
  | 'disputes'
  | 'vip'
  | 'treasury'
  | 'custody'
  | 'fees'
  | 'refunds'
  | 'users'
  | 'logs'
  | 'settings';

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  minRole: AdminRole;
  Component: () => ReactNode;
}

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', minRole: 'viewer', Component: DashboardTab },
  { key: 'rolls', label: 'Rolls', icon: '🎲', minRole: 'ops', Component: RollsTab },
  { key: 'pools', label: 'Pools', icon: '💧', minRole: 'viewer', Component: PoolsTab },
  { key: 'trades', label: 'Trades', icon: '🔄', minRole: 'viewer', Component: TradesTab },
  { key: 'disputes', label: 'Disputes', icon: '⚖️', minRole: 'viewer', Component: DisputesTab },
  { key: 'vip', label: 'VIP', icon: '👑', minRole: 'ops', Component: VipTab },
  { key: 'treasury', label: 'Treasury', icon: '🏦', minRole: 'admin', Component: TreasuryTab },
  { key: 'custody', label: 'Custody', icon: '🏦', minRole: 'ops', Component: CustodyTab },
  { key: 'fees', label: 'Fees', icon: '💰', minRole: 'admin', Component: FeesTab },
  { key: 'refunds', label: 'Refunds', icon: '↩️', minRole: 'ops', Component: RefundsTab },
  { key: 'users', label: 'Users', icon: '👥', minRole: 'viewer', Component: UsersTab },
  { key: 'logs', label: 'Logs', icon: '📋', minRole: 'viewer', Component: LogsTab },
  { key: 'settings', label: 'Settings', icon: '⚙️', minRole: 'ops', Component: SettingsTab },
];

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  viewer: 1,
  ops: 2,
  admin: 3,
};

function canAccessTab(userRole: AdminRole, tabMinRole: AdminRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[tabMinRole];
}

interface AdminShellProps {
  role: AdminRole;
}

export default function AdminShell({ role }: AdminShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  const accessibleTabs = TABS.filter(t => canAccessTab(role, t.minRole));

  useEffect(() => {
    const tab = (searchParams.get('tab') as TabKey) || 'dashboard';
    const tabDef = accessibleTabs.find(t => t.key === tab);
    if (tabDef) {
      setActiveTab(tab);
    } else {
      setActiveTab('dashboard');
    }
  }, [searchParams, accessibleTabs]);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    router.push(`/admin?tab=${key}`, { scroll: false });
  };

  const activeTabDef = TABS.find(t => t.key === activeTab);
  const ActiveComponent = activeTabDef?.Component || (() => null);

  return (
    <div className="min-h-screen flex" style={{ background: '#050806' }}>
      {/* Sidebar */}
      <aside
        className="w-[240px] shrink-0 border-r pt-6"
        style={{ background: '#0F1712', borderColor: '#1f1f1f' }}
      >
        <div className="px-4 mb-6">
          <div
            className="px-3 py-2 rounded-lg inline-flex items-center gap-2"
            style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.3)' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: '#FF4D5E' }} />
            <span className="text-xs font-bold" style={{ color: '#FF4D5E' }}>
              ADMIN
            </span>
            <span
              className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded"
              style={{
                background: role === 'admin' ? '#00c9a720' : role === 'ops' ? '#FFB02020' : '#8FA39820',
                color: role === 'admin' ? '#00c9a7' : role === 'ops' ? '#FFB020' : '#8FA398',
              }}
            >
              {role.toUpperCase()}
            </span>
          </div>
        </div>
        <nav className="space-y-1 px-3">
          {accessibleTabs.map(item => (
            <button
              key={item.key}
              onClick={() => handleTabChange(item.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
              style={{
                background: activeTab === item.key ? 'rgba(0,201,167,0.15)' : 'transparent',
                color: activeTab === item.key ? '#00c9a7' : '#8FA398',
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 overflow-auto">
        <ActiveComponent />
      </main>
    </div>
  );
}
