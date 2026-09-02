'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate, Drawer } from '../ui';

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

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const loadUsers = async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : '/api/admin/users';
      const data = await apiFetch<{ users: User[] }>(url);
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(search);
  }, [search]);

  const handleAction = async (id: string, action: string, reason?: string, role?: string) => {
    try {
      await apiFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason, role }),
      });
      await loadUsers(search);
      setSelectedUser(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    }
  };

  if (loading && users.length === 0) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={() => loadUsers(search)} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Users</h1>
        <input
          type="text"
          placeholder="Search by email, wallet, or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm w-80"
          style={{ background: '#0F1712', border: '1px solid #1f1f1f', color: '#fff' }}
        />
      </div>

      <DataTable
        columns={[
          {
            key: 'user',
            label: 'User',
            render: u => (
              <div>
                <div style={{ color: '#fff' }}>{u.display_name || u.email || 'N/A'}</div>
                {u.wallet_address && (
                  <div className="text-xs font-mono" style={{ color: '#8FA398' }}>
                    {u.wallet_address.slice(0, 10)}...
                  </div>
                )}
              </div>
            ),
          },
          { key: 'role', label: 'Role', render: u => <StatusChip status={u.role.toUpperCase()} label={u.role} /> },
          { key: 'vip', label: 'VIP', render: u => <StatusChip status={u.vip_status.toUpperCase()} /> },
          { key: 'banned', label: 'Status', render: u => (u.banned_at ? <StatusChip status="BANNED" /> : <StatusChip status="ACTIVE" />) },
          { key: 'created', label: 'Created', render: u => formatDate(u.created_at) },
          {
            key: 'actions',
            label: 'Actions',
            render: u => (
              <button
                onClick={() => setSelectedUser(u)}
                className="px-3 py-1 rounded text-xs font-bold"
                style={{ background: '#00c9a740', color: '#00c9a7', border: '1px solid #00c9a7' }}
              >
                Manage
              </button>
            ),
          },
        ]}
        data={users}
        keyExtractor={u => u.id}
        emptyText="No users found"
      />

      {selectedUser && (
        <Drawer
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          title="Manage User"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: '#8FA398' }}>User</label>
              <p className="text-white">{selectedUser.display_name || selectedUser.email}</p>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: '#8FA398' }}>Current Role</label>
              <p className="text-white font-mono">{selectedUser.role}</p>
            </div>
            {!selectedUser.banned_at ? (
              <button
                onClick={() => {
                  const reason = prompt('Ban reason:');
                  if (reason) handleAction(selectedUser.id, 'ban', reason);
                }}
                className="w-full px-4 py-3 rounded-lg font-bold"
                style={{ background: '#FF4D5E', color: '#fff' }}
              >
                Ban User
              </button>
            ) : (
              <button
                onClick={() => handleAction(selectedUser.id, 'unban')}
                className="w-full px-4 py-3 rounded-lg font-bold"
                style={{ background: '#00c9a7', color: '#fff' }}
              >
                Unban User
              </button>
            )}
            {selectedUser.vip_status === 'approved' && (
              <button
                onClick={() => handleAction(selectedUser.id, 'revoke_vip')}
                className="w-full px-4 py-3 rounded-lg font-bold"
                style={{ background: '#FFB020', color: '#050806' }}
              >
                Revoke VIP
              </button>
            )}
            <div className="pt-4 border-t" style={{ borderColor: '#1f1f1f' }}>
              <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Change Role (admin only)</label>
              <div className="flex gap-2">
                {['user', 'viewer', 'ops', 'admin'].map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      if (confirm(`Set role to ${r}?`)) handleAction(selectedUser.id, 'set_role', undefined, r);
                    }}
                    className="flex-1 px-3 py-2 rounded text-xs font-bold"
                    style={{
                      background: selectedUser.role === r ? '#00c9a7' : '#111',
                      color: selectedUser.role === r ? '#050806' : '#fff',
                      border: '1px solid #1f1f1f',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
