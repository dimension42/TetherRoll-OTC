type PoolStatus = 'DRAFT' | 'LOCKING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'HIDDEN';
type TradeStatus = 'PENDING' | 'AWAITING_BOND' | 'ACTIVE' | 'PAID' | 'RELEASED' | 'CANCELLED' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED';

const POOL_STATUS_MAP: Record<PoolStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'rgba(136,136,136,0.1)', color: '#888', label: 'Draft' },
  LOCKING: { bg: 'rgba(245,166,35,0.1)', color: '#f5a623', label: 'Locking...' },
  OPEN: { bg: 'rgba(0,255,136,0.1)', color: '#00ff88', label: 'Open' },
  PARTIAL: { bg: 'rgba(168,85,247,0.1)', color: '#c084fc', label: 'Partial' },
  FILLED: { bg: 'rgba(0,201,167,0.1)', color: '#00c9a7', label: 'Filled' },
  CANCELLED: { bg: 'rgba(255,68,102,0.1)', color: '#ff4466', label: 'Cancelled' },
  EXPIRED: { bg: 'rgba(136,136,136,0.1)', color: '#888', label: 'Expired' },
  HIDDEN: { bg: 'rgba(136,136,136,0.1)', color: '#666', label: 'Hidden' },
};

const TRADE_STATUS_MAP: Record<TradeStatus, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'rgba(245,166,35,0.1)', color: '#f5a623', label: 'Pending' },
  AWAITING_BOND: { bg: 'rgba(245,166,35,0.1)', color: '#f5a623', label: 'Awaiting Bond' },
  ACTIVE: { bg: 'rgba(0,255,136,0.1)', color: '#00ff88', label: 'Active' },
  PAID: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', label: 'Paid' },
  RELEASED: { bg: 'rgba(0,201,167,0.1)', color: '#00c9a7', label: 'Released' },
  CANCELLED: { bg: 'rgba(255,68,102,0.1)', color: '#ff4466', label: 'Cancelled' },
  EXPIRED: { bg: 'rgba(136,136,136,0.1)', color: '#888', label: 'Expired' },
  DISPUTED: { bg: 'rgba(251,146,60,0.1)', color: '#fb923c', label: 'Disputed' },
  RESOLVED: { bg: 'rgba(99,102,241,0.1)', color: '#a78bfa', label: 'Resolved' },
};

export function StatusChip({ status, type = 'pool' }: { status: string; type?: 'pool' | 'trade' }) {
  const map = type === 'pool' ? POOL_STATUS_MAP : TRADE_STATUS_MAP;
  const config = map[status as keyof typeof map] || { bg: 'rgba(255,255,255,0.05)', color: '#888', label: status };

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.color}33`,
      }}
    >
      {config.label}
    </span>
  );
}
