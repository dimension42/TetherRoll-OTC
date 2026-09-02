'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate, Drawer } from '../ui';

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

export default function VipTab() {
  const [requests, setRequests] = useState<VipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<VipRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ requests: VipRequest[] }>('/api/admin/vip-requests');
      setRequests(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    // B-08 fix: validate expiresAt
    if (actionType === 'approve') {
      if (!expiresAt) {
        alert('Expiry date required for approval');
        return;
      }
      const expiry = new Date(expiresAt);
      if (isNaN(expiry.getTime()) || expiry <= new Date()) {
        alert('Expiry must be a valid future date');
        return;
      }
    }
    if (actionType === 'reject' && !rejectReason.trim()) {
      alert('Reject reason required');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/vip-requests/${selectedRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          rejectReason: actionType === 'reject' ? rejectReason.trim() : undefined,
          expiresAt: actionType === 'approve' ? expiresAt : undefined,
        }),
      });
      setSelectedRequest(null);
      setActionType(null);
      setRejectReason('');
      setExpiresAt('');
      await loadRequests();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadRequests} />;

  const pending = requests.filter(r => r.status === 'pending');
  const reviewed = requests.filter(r => r.status !== 'pending');

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">VIP Access Requests</h1>

      <h2 className="text-lg font-bold text-white mb-4">Pending ({pending.length})</h2>
      <div className="mb-8">
        <DataTable
          columns={[
            {
              key: 'user',
              label: 'User',
              render: r => (
                <div>
                  <div style={{ color: '#fff' }}>{r.users.display_name || r.users.email || 'N/A'}</div>
                  {r.users.wallet_address && (
                    <div className="text-xs font-mono" style={{ color: '#8FA398' }}>
                      {r.users.wallet_address.slice(0, 10)}...
                    </div>
                  )}
                </div>
              ),
            },
            { key: 'reason', label: 'Reason', render: r => <span className="text-sm">{r.reason}</span> },
            { key: 'volume', label: 'Expected Volume', render: r => <span className="text-sm">{r.expected_volume}</span> },
            { key: 'created', label: 'Requested', render: r => formatDate(r.created_at) },
            {
              key: 'actions',
              label: 'Actions',
              render: r => (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedRequest(r); setActionType('approve'); }}
                    className="px-3 py-1 rounded text-xs font-bold"
                    style={{ background: '#00c9a7', color: '#050806' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => { setSelectedRequest(r); setActionType('reject'); }}
                    className="px-3 py-1 rounded text-xs font-bold"
                    style={{ background: '#FF4D5E', color: '#fff' }}
                  >
                    Reject
                  </button>
                </div>
              ),
            },
          ]}
          data={pending}
          keyExtractor={r => r.id}
          emptyText="No pending requests"
        />
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Reviewed ({reviewed.length})</h2>
      <DataTable
        columns={[
          { key: 'user', label: 'User', render: r => r.users.display_name || r.users.email || 'N/A' },
          { key: 'status', label: 'Status', render: r => <StatusChip status={r.status.toUpperCase()} /> },
          { key: 'reviewed', label: 'Reviewed', render: r => (r.reviewed_at ? formatDate(r.reviewed_at) : '—') },
          { key: 'reason', label: 'Reject Reason', render: r => r.reject_reason || '—' },
        ]}
        data={reviewed}
        keyExtractor={r => r.id}
        emptyText="No reviewed requests"
      />

      {selectedRequest && actionType && (
        <Drawer
          isOpen={true}
          onClose={() => { setSelectedRequest(null); setActionType(null); }}
          title={actionType === 'approve' ? 'Approve VIP Access' : 'Reject Request'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: '#8FA398' }}>User</label>
              <p className="text-white">{selectedRequest.users.display_name || selectedRequest.users.email}</p>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: '#8FA398' }}>Reason</label>
              <p className="text-sm" style={{ color: '#C8D5D0' }}>{selectedRequest.reason}</p>
            </div>
            {actionType === 'approve' && (
              <div>
                <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Expiry Date (required)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg text-sm"
                  style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                />
              </div>
            )}
            {actionType === 'reject' && (
              <div>
                <label className="block text-sm mb-2" style={{ color: '#8FA398' }}>Reject Reason (required)</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg text-sm"
                  style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                />
              </div>
            )}
            <button
              onClick={handleAction}
              disabled={submitting}
              className="w-full px-4 py-3 rounded-lg font-bold"
              style={{ background: actionType === 'approve' ? '#00c9a7' : '#FF4D5E', color: '#fff', opacity: submitting ? 0.5 : 1 }}
            >
              {submitting ? 'Processing...' : actionType === 'approve' ? 'Approve Access' : 'Reject Request'}
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
