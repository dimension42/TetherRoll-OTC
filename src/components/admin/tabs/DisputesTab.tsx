'use client';

import { useState, useEffect } from 'react';
import { apiFetch, DataTable, Loading, ErrorMessage, StatusChip, formatDate, Drawer } from '../ui';
import { useContractAdmin } from '../hooks/useContractAdmin';

interface Dispute {
  id: string;
  trade_id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface DisputeDetail {
  id: string;
  trade_id: string;
  status: string;
  note: string | null;
  decision_note: string | null;
  created_at: string;
  evidenceUrls: { path: string; url: string | null }[];
  trade: {
    id: string;
    chain_id: number;
    onchain_trade_id: bigint;
    seller: { id: string; email: string | null; wallet_address: string | null; display_name: string | null };
    buyer: { id: string; email: string | null; wallet_address: string | null; display_name: string | null };
  };
}

export default function DisputesTab() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<DisputeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [decision, setDecision] = useState<'buyer' | 'seller' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDisputes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ disputes: Dispute[] }>('/api/admin/disputes');
      setDisputes(data.disputes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const handleRowClick = async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await apiFetch<{ dispute: DisputeDetail }>(`/api/admin/disputes/${id}`);
      setSelectedDispute(data.dispute);
      setDecision(null);
      setDecisionNote('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDecision = async () => {
    if (!selectedDispute || !decision) {
      alert('Decision required');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/disputes/${selectedDispute.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: decisionNote }),
      });
      // Reload detail to show updated status
      const data = await apiFetch<{ dispute: DisputeDetail }>(`/api/admin/disputes/${selectedDispute.id}`);
      setSelectedDispute(data.dispute);
      await loadDisputes();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} onRetry={loadDisputes} />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Disputes</h1>
      <DataTable
        columns={[
          { key: 'id', label: 'ID', render: d => <span className="font-mono text-xs">{d.id.slice(0, 8)}...</span> },
          { key: 'trade', label: 'Trade ID', render: d => <span className="font-mono text-xs">{d.trade_id.slice(0, 8)}...</span> },
          { key: 'status', label: 'Status', render: d => <StatusChip status={d.status} /> },
          { key: 'note', label: 'Note', render: d => d.note || '—' },
          { key: 'created', label: 'Created', render: d => formatDate(d.created_at) },
          {
            key: 'actions',
            label: '',
            render: d => (
              <button
                onClick={() => handleRowClick(d.id)}
                className="px-3 py-1 rounded text-xs font-bold"
                style={{ background: '#00c9a740', color: '#00c9a7' }}
              >
                View
              </button>
            ),
          },
        ]}
        data={disputes}
        keyExtractor={d => d.id}
        emptyText="No disputes"
      />

      {selectedDispute && (
        <Drawer isOpen={true} onClose={() => setSelectedDispute(null)} title="Dispute Detail" width="800px">
          {loadingDetail ? (
            <Loading />
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Trade Summary</h3>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Trade ID: <span className="font-mono text-white">{selectedDispute.trade.id}</span></p>
                <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Chain ID: <span className="font-mono text-white">{selectedDispute.trade.chain_id}</span></p>
                <p className="text-xs" style={{ color: '#8FA398' }}>On-Chain Trade ID: <span className="font-mono text-white">{selectedDispute.trade.onchain_trade_id.toString()}</span></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                  <h3 className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Seller (Crypto Provider)</h3>
                  <p className="text-xs" style={{ color: '#C8D5D0' }}>{selectedDispute.trade.seller.display_name || selectedDispute.trade.seller.email || 'N/A'}</p>
                  {selectedDispute.trade.seller.wallet_address && (
                    <p className="text-xs font-mono" style={{ color: '#8FA398' }}>{selectedDispute.trade.seller.wallet_address.slice(0, 10)}...</p>
                  )}
                </div>
                <div className="p-4 rounded-lg" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                  <h3 className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Buyer (KRW Sender)</h3>
                  <p className="text-xs" style={{ color: '#C8D5D0' }}>{selectedDispute.trade.buyer.display_name || selectedDispute.trade.buyer.email || 'N/A'}</p>
                  {selectedDispute.trade.buyer.wallet_address && (
                    <p className="text-xs font-mono" style={{ color: '#8FA398' }}>{selectedDispute.trade.buyer.wallet_address.slice(0, 10)}...</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Dispute Note</h3>
                <p className="text-sm p-3 rounded" style={{ background: '#111', color: '#C8D5D0' }}>
                  {selectedDispute.note || 'No note provided'}
                </p>
              </div>

              {selectedDispute.evidenceUrls.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Evidence</h3>
                  <div className="space-y-2">
                    {selectedDispute.evidenceUrls.map((ev, i) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(ev.path);
                      return (
                        <div key={i} className="p-3 rounded" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                          {isImage && ev.url ? (
                            <img src={ev.url} alt={`Evidence ${i + 1}`} className="max-w-full rounded mb-2" />
                          ) : null}
                          <a
                            href={ev.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline"
                            style={{ color: '#00c9a7' }}
                          >
                            {ev.path}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedDispute.status === 'OPEN' && (
                <div className="pt-4 border-t" style={{ borderColor: '#1f1f1f' }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>Record Decision</h3>
                  <div className="flex gap-3 mb-3">
                    <button
                      onClick={() => setDecision('buyer')}
                      className="flex-1 px-4 py-2 rounded-lg font-bold text-sm"
                      style={{
                        background: decision === 'buyer' ? '#00c9a7' : '#111',
                        color: decision === 'buyer' ? '#fff' : '#8FA398',
                        border: `1px solid ${decision === 'buyer' ? '#00c9a7' : '#1f1f1f'}`,
                      }}
                    >
                      Buyer Wins
                    </button>
                    <button
                      onClick={() => setDecision('seller')}
                      className="flex-1 px-4 py-2 rounded-lg font-bold text-sm"
                      style={{
                        background: decision === 'seller' ? '#00c9a7' : '#111',
                        color: decision === 'seller' ? '#fff' : '#8FA398',
                        border: `1px solid ${decision === 'seller' ? '#00c9a7' : '#1f1f1f'}`,
                      }}
                    >
                      Seller Wins
                    </button>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs mb-1" style={{ color: '#8FA398' }}>Decision Note (optional)</label>
                    <textarea
                      value={decisionNote}
                      onChange={e => setDecisionNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
                    />
                  </div>
                  <button
                    onClick={handleDecision}
                    disabled={!decision || submitting}
                    className="w-full px-4 py-3 rounded-lg font-bold"
                    style={{ background: '#FFB020', color: '#050806', opacity: !decision || submitting ? 0.5 : 1 }}
                  >
                    {submitting ? 'Recording...' : 'Record Decision'}
                  </button>
                </div>
              )}

              {selectedDispute.status.startsWith('RESOLVED_') && (
                <div className="pt-4 border-t" style={{ borderColor: '#1f1f1f' }}>
                  <h3 className="text-sm font-bold mb-2" style={{ color: '#fff' }}>Execute On-Chain</h3>
                  <div className="p-3 rounded mb-3" style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                    <p className="text-xs" style={{ color: '#8FA398' }}>
                      Decision: <span style={{ color: '#00c9a7' }}>{selectedDispute.status.replace('RESOLVED_', '')} WINS</span>
                    </p>
                    {selectedDispute.decision_note && (
                      <p className="text-xs mt-1" style={{ color: '#C8D5D0' }}>Note: {selectedDispute.decision_note}</p>
                    )}
                  </div>
                  <ResolveOnChain
                    disputeId={selectedDispute.id}
                    tradeId={selectedDispute.trade.onchain_trade_id}
                    chainId={selectedDispute.trade.chain_id}
                    buyerWins={selectedDispute.status === 'RESOLVED_BUYER'}
                    onSuccess={() => {
                      setSelectedDispute(null);
                      loadDisputes();
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}

function ResolveOnChain({ disputeId, tradeId, chainId, buyerWins, onSuccess }: { disputeId: string; tradeId: bigint; chainId: number; buyerWins: boolean; onSuccess: () => void }) {
  const contract = useContractAdmin(chainId);
  const [confirming, setConfirming] = useState(false);

  const handleResolve = async () => {
    if (!confirm(`Execute on-chain resolution (${buyerWins ? 'Buyer' : 'Seller'} wins)?`)) return;
    try {
      contract.resolveDispute(BigInt(tradeId), buyerWins);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Transaction failed');
    }
  };

  useEffect(() => {
    if (contract.isConfirmed && contract.txHash && confirming) {
      apiFetch(`/api/admin/disputes/${disputeId}/resolve-tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: contract.txHash }),
      })
        .then(() => {
          alert('Dispute resolved on-chain!');
          setConfirming(false);
          onSuccess();
        })
        .catch(err => {
          alert(`TX confirmed but API failed: ${err.message}`);
          setConfirming(false);
        });
    }
  }, [contract.isConfirmed, contract.txHash, disputeId, confirming, onSuccess]);

  useEffect(() => {
    if (contract.isPending || contract.isConfirming) {
      setConfirming(true);
    }
  }, [contract.isPending, contract.isConfirming]);

  if (!contract.isArbitrator) {
    return (
      <div className="p-3 rounded" style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid #FF4D5E40' }}>
        <p className="text-xs" style={{ color: '#FF4D5E' }}>
          ⚠️ Connected wallet does not have ARBITRATOR_ROLE on chain {chainId}
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleResolve}
        disabled={contract.isPending || contract.isConfirming}
        className="w-full px-4 py-3 rounded-lg font-bold"
        style={{ background: '#00c9a7', color: '#fff', opacity: contract.isPending || contract.isConfirming ? 0.5 : 1 }}
      >
        {contract.isPending ? 'Confirm in Wallet...' : contract.isConfirming ? 'Resolving...' : 'Execute resolveDispute()'}
      </button>
      {contract.txHash && (
        <div className="mt-3 p-3 rounded" style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid #00c9a740' }}>
          <p className="text-xs mb-1" style={{ color: '#8FA398' }}>Transaction:</p>
          <a
            href={contract.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono underline break-all"
            style={{ color: '#00c9a7' }}
          >
            {contract.txHash}
          </a>
          <p className="text-xs mt-2" style={{ color: contract.isConfirmed ? '#00c9a7' : '#FFB020' }}>
            {contract.isConfirmed ? '✓ Confirmed' : '⏳ Confirming...'}
          </p>
        </div>
      )}
    </>
  );
}
