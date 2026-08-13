'use client';

import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

type Tab = 'dashboard' | 'vip-requests' | 'users' | 'audit-logs';

interface Stats {
  totalUsers: number;
  vipPending: number;
  vipApproved: number;
  poolsOpen: number;
  poolsTotal: number;
  bannedUsers: number;
}

interface VipRequest {
  id: string;
  user_id: string;
  reason: string;
  expected_volume: string;
  contact: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  users: {
    email: string | null;
    wallet_address: string | null;
    display_name: string | null;
  };
}

interface User {
  id: string;
  email: string | null;
  wallet_address: string | null;
  display_name: string | null;
  role: string;
  vip_status: string;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
  users: {
    email: string | null;
    display_name: string | null;
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortenId(str: string | null, len = 8): string {
  if (!str) return 'N/A';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

function jsonSummary(obj: unknown): string {
  if (!obj) return '—';
  const str = JSON.stringify(obj);
  return str.length > 100 ? str.slice(0, 100) + '…' : str;
}

// ============================================================================
// Modal Component
// ============================================================================

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="max-w-md w-full rounded-2xl p-6"
        style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminConsole() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen flex" style={{ background: '#050806' }}>
      {/* Sidebar */}
      <aside
        className="w-[220px] shrink-0 border-r pt-6"
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
          </div>
        </div>
        <nav className="space-y-1 px-3">
          {[
            { key: 'dashboard' as const, label: 'Dashboard', icon: '📊' },
            { key: 'vip-requests' as const, label: 'VIP Requests', icon: '👑' },
            { key: 'users' as const, label: 'Users', icon: '👥' },
            { key: 'audit-logs' as const, label: 'Audit Logs', icon: '📋' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
              style={{
                background: tab === item.key ? 'rgba(0,201,167,0.15)' : 'transparent',
                color: tab === item.key ? '#00c9a7' : '#8FA398',
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
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'vip-requests' && <VipRequestsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'audit-logs' && <AuditLogsTab />}
      </main>
    </div>
  );
}

// ============================================================================
// Dashboard Tab
// ============================================================================

function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ stats: Stats }>('/api/admin/stats');
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error}</p>
        <button className="btn-primary" onClick={loadStats}>
          Retry
        </button>
      </div>
    );
  }

  const tiles = stats
    ? [
        {
          label: 'Total Users',
          value: stats.totalUsers.toLocaleString(),
          color: '#00c9a7',
          warn: false,
        },
        {
          label: 'VIP Pending',
          value: stats.vipPending.toLocaleString(),
          color: stats.vipPending > 0 ? '#FFB020' : '#8FA398',
          warn: stats.vipPending > 0,
        },
        {
          label: 'VIP Approved',
          value: stats.vipApproved.toLocaleString(),
          color: '#00c9a7',
          warn: false,
        },
        {
          label: 'Pools Open',
          value: stats.poolsOpen.toLocaleString(),
          color: '#00c9a7',
          warn: false,
        },
        {
          label: 'Pools Total',
          value: stats.poolsTotal.toLocaleString(),
          color: '#8FA398',
          warn: false,
        },
        {
          label: 'Banned Users',
          value: stats.bannedUsers.toLocaleString(),
          color: '#FF4D5E',
          warn: false,
        },
      ]
    : [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {tiles.map(t => (
          <div
            key={t.label}
            className="p-6 rounded-xl"
            style={{
              background: t.warn ? 'rgba(255,176,32,0.08)' : '#111',
              border: `1px solid ${t.warn ? 'rgba(255,176,32,0.3)' : '#1f1f1f'}`,
            }}
          >
            <p className="text-sm mb-2" style={{ color: '#8FA398' }}>
              {t.label}
            </p>
            <p className="text-4xl font-black" style={{ color: t.color, fontVariantNumeric: 'tabular-nums' }}>
              {t.value}
            </p>
          </div>
        ))}
      </div>
      <div className="p-6 rounded-xl" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
        <p className="text-sm" style={{ color: '#8FA398' }}>
          Phase 2에서 Roll Order·수수료 수익 위젯 추가 예정
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// VIP Requests Tab
// ============================================================================

function VipRequestsTab() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<VipRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ requests: VipRequest[] }>(`/api/admin/vip-requests?status=${status}`);
      setRequests(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this VIP request?')) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/vip-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      await loadRequests();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/vip-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rejectModal.id, action: 'reject', rejectReason: rejectReason.trim() }),
      });
      setRejectModal(null);
      setRejectReason('');
      await loadRequests();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">VIP Requests</h1>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
            style={{
              background: status === s ? 'rgba(0,201,167,0.15)' : '#111',
              color: status === s ? '#00c9a7' : '#8FA398',
              border: `1px solid ${status === s ? '#00c9a7' : '#1f1f1f'}`,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loading/Error */}
      {loading && (
        <div className="text-center py-12">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
          />
        </div>
      )}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button className="btn-primary" onClick={loadRequests}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && requests.length === 0 && (
        <div className="text-center py-12">
          <p style={{ color: '#8FA398' }}>No {status} requests</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && requests.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  User
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Reason
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Expected Vol
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Contact
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Created
                </th>
                {status === 'pending' && (
                  <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                    Actions
                  </th>
                )}
                {status === 'rejected' && (
                  <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                    Reject Reason
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1f1f1f' }}>
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white">
                    {req.users.email || shortenId(req.users.wallet_address, 12)}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#8FA398' }}>
                    {req.reason.slice(0, 50)}
                    {req.reason.length > 50 && '…'}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#8FA398' }}>
                    {req.expected_volume}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#8FA398' }}>
                    {req.contact}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8FA398' }}>
                    {formatDate(req.created_at)}
                  </td>
                  {status === 'pending' && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 rounded text-xs font-semibold"
                          style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                          onClick={() => handleApprove(req.id)}
                          disabled={submitting}
                        >
                          Approve
                        </button>
                        <button
                          className="px-3 py-1 rounded text-xs font-semibold"
                          style={{ background: 'rgba(255,77,94,0.15)', color: '#FF4D5E' }}
                          onClick={() => setRejectModal({ id: req.id })}
                          disabled={submitting}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
                  {status === 'rejected' && (
                    <td className="px-4 py-3 text-xs" style={{ color: '#FF4D5E' }}>
                      {req.reject_reason || '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <Modal title="Reject VIP Request" onClose={() => setRejectModal(null)}>
          <textarea
            className="input-dark w-full h-24 mb-4"
            placeholder="Rejection reason (required)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#1f1f1f', color: '#8FA398' }}
              onClick={() => setRejectModal(null)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(255,77,94,0.15)', color: '#FF4D5E' }}
              onClick={handleRejectSubmit}
              disabled={submitting || !rejectReason.trim()}
            >
              {submitting ? 'Submitting...' : 'Reject'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// Users Tab
// ============================================================================

function UsersTab() {
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [banModal, setBanModal] = useState<{ id: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ users: User[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setQuery(searchInput);
    loadUsers(searchInput);
  };

  const handleAction = async (id: string, action: 'ban' | 'unban' | 'revoke_vip', reason?: string) => {
    if (action === 'ban' && !reason?.trim()) return;
    if (!confirm(`${action.toUpperCase()} this user?`)) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason: reason?.trim() }),
      });
      await loadUsers(query);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBanSubmit = async () => {
    if (!banModal || !banReason.trim()) return;
    await handleAction(banModal.id, 'ban', banReason);
    setBanModal(null);
    setBanReason('');
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Users</h1>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          className="input-dark flex-1"
          placeholder="Search by email, wallet, or name"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn-primary" onClick={handleSearch}>
          Search
        </button>
      </div>

      {/* Loading/Error */}
      {loading && (
        <div className="text-center py-12">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
          />
        </div>
      )}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && users.length === 0 && query && (
        <div className="text-center py-12">
          <p style={{ color: '#8FA398' }}>No users found</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && users.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  User
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Role
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  VIP Status
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Created
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1f1f1f' }}>
              {users.map(user => {
                const isBanned = !!user.banned_at;
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-white/5 transition-colors"
                    style={{ opacity: isBanned ? 0.5 : 1 }}
                  >
                    <td className="px-4 py-3">
                      <div className="text-white text-sm">
                        {user.display_name || user.email || shortenId(user.wallet_address, 12)}
                      </div>
                      {isBanned && (
                        <div className="text-xs mt-1" style={{ color: '#FF4D5E' }} title={user.ban_reason || undefined}>
                          Banned{user.ban_reason && `: ${user.ban_reason.slice(0, 30)}${user.ban_reason.length > 30 ? '…' : ''}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: user.role === 'admin' ? 'rgba(255,77,94,0.15)' : 'rgba(143,163,152,0.15)',
                          color: user.role === 'admin' ? '#FF4D5E' : '#8FA398',
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background:
                            user.vip_status === 'approved'
                              ? 'rgba(0,201,167,0.15)'
                              : 'rgba(143,163,152,0.15)',
                          color: user.vip_status === 'approved' ? '#00c9a7' : '#8FA398',
                        }}
                      >
                        {user.vip_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8FA398' }}>
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!isBanned && (
                          <button
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: 'rgba(255,77,94,0.15)', color: '#FF4D5E' }}
                            onClick={() => setBanModal({ id: user.id })}
                            disabled={submitting}
                          >
                            Ban
                          </button>
                        )}
                        {isBanned && (
                          <button
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7' }}
                            onClick={() => handleAction(user.id, 'unban')}
                            disabled={submitting}
                          >
                            Unban
                          </button>
                        )}
                        {user.vip_status === 'approved' && (
                          <button
                            className="px-3 py-1 rounded text-xs font-semibold"
                            style={{ background: 'rgba(255,176,32,0.15)', color: '#FFB020' }}
                            onClick={() => handleAction(user.id, 'revoke_vip')}
                            disabled={submitting}
                          >
                            Revoke VIP
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Ban modal */}
      {banModal && (
        <Modal title="Ban User" onClose={() => setBanModal(null)}>
          <textarea
            className="input-dark w-full h-24 mb-4"
            placeholder="Ban reason (required)"
            value={banReason}
            onChange={e => setBanReason(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#1f1f1f', color: '#8FA398' }}
              onClick={() => setBanModal(null)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(255,77,94,0.15)', color: '#FF4D5E' }}
              onClick={handleBanSubmit}
              disabled={submitting || !banReason.trim()}
            >
              {submitting ? 'Banning...' : 'Ban'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// Audit Logs Tab
// ============================================================================

function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ logs: AuditLog[] }>('/api/admin/audit-logs');
      setLogs(data.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Audit Logs</h1>

      {/* Loading/Error */}
      {loading && (
        <div className="text-center py-12">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
          />
        </div>
      )}
      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button className="btn-primary" onClick={loadLogs}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && logs.length === 0 && (
        <div className="text-center py-12">
          <p style={{ color: '#8FA398' }}>No audit logs</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && logs.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Admin
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Action
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Target
                </th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: '#8FA398' }}>
                  Changes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1f1f1f' }}>
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-xs" style={{ color: '#8FA398' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {log.users.email || log.users.display_name || 'System'}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs" style={{ color: '#00c9a7' }}>
                      {log.action}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8FA398' }}>
                    {log.target_type && log.target_id
                      ? `${log.target_type}:${shortenId(log.target_id)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8FA398' }}>
                    {log.before ? (
                      <div className="mb-1">
                        <span style={{ color: '#FF4D5E' }}>Before:</span>{' '}
                        <code>{jsonSummary(log.before)}</code>
                      </div>
                    ) : null}
                    {log.after ? (
                      <div>
                        <span style={{ color: '#00c9a7' }}>After:</span>{' '}
                        <code>{jsonSummary(log.after)}</code>
                      </div>
                    ) : null}
                    {!log.before && !log.after ? '—' : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
