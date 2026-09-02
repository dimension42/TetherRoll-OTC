'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFiatTrade } from '@/hooks/useEscrowVault';
import { type Trade, type BankInfo } from '@/lib/types';
import { EmptyState } from '@/components/ui/EmptyState';
import ChainGuard from '@/components/wallet/ChainGuard';
import { TradeTimeline } from '@/components/trades/TradeTimeline';
import { TradeHeader } from '@/components/trades/TradeHeader';
import { BankInfoCard } from '@/components/trades/BankInfoCard';
import { TradeActions } from '@/components/trades/TradeActions';
import { CHAIN_META } from '@/lib/chains';

export default function TradeDetailPage() {
  const params = useParams();
  const tradeId = params.id as string;
  const { user, ready: authReady } = useAuth();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch trade data from API
  useEffect(() => {
    async function fetchTrade() {
      try {
        const res = await fetch(`/api/trades/${tradeId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Trade not found');
            return;
          }
          throw new Error(`Failed to fetch trade: ${res.status}`);
        }
        const data = await res.json();
        setTrade(data.trade);
        setBankInfo(data.bankInfo || null);
      } catch (err) {
        console.error('Failed to fetch trade:', err);
        setError(err instanceof Error ? err.message : 'Failed to load trade');
      } finally {
        setLoading(false);
      }
    }

    if (authReady) {
      fetchTrade();
    }
  }, [tradeId, authReady]);

  // Poll on-chain state every 10s
  const { trade: onchainTrade, refetch: refetchOnchain } = useFiatTrade(
    trade?.onchain_trade_id ?? null
  );

  useEffect(() => {
    if (!trade?.onchain_trade_id) return;

    const interval = setInterval(() => {
      refetchOnchain();
    }, 10000);

    return () => clearInterval(interval);
  }, [trade?.onchain_trade_id, refetchOnchain]);

  // Check if user is a party to this trade
  const isSeller = user?.id === trade?.seller_id;
  const isBuyer = user?.id === trade?.buyer_id;
  const isParty = isSeller || isBuyer;

  // Determine effective status (prefer on-chain)
  const effectiveStatus = onchainTrade
    ? (['AWAITING_BOND', 'ACTIVE', 'PAID', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'RESOLVED'] as const)[onchainTrade.status]
    : trade?.status;

  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#00c9a7' }} />
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon="🔍"
          title={error || 'Trade not found'}
          description="This trade does not exist or you do not have access to it."
        />
      </div>
    );
  }

  if (!isParty) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon="🔒"
          title="Access Denied"
          description="You are not a party to this trade."
        />
      </div>
    );
  }

  const chainMeta = CHAIN_META[trade.chain_id];

  return (
    <ChainGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <TradeHeader
            trade={trade}
            effectiveStatus={effectiveStatus || trade.status}
            isSeller={isSeller}
            isBuyer={isBuyer}
            chainMeta={chainMeta}
          />

          {/* Timeline */}
          <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
            <h3 className="text-lg font-bold text-white mb-6">Trade Progress</h3>
            <TradeTimeline status={effectiveStatus || trade.status} />
          </div>

          {/* Bank Info (buyer only, in active states) */}
          {isBuyer && bankInfo && ['ACTIVE', 'PAID'].includes(effectiveStatus || trade.status) && trade.fiat_amount && (
            <BankInfoCard bankInfo={bankInfo} fiatAmount={trade.fiat_amount} />
          )}

          {/* Actions */}
          <TradeActions
            trade={trade}
            onchainTrade={onchainTrade || undefined}
            effectiveStatus={effectiveStatus || trade.status}
            isSeller={isSeller}
            isBuyer={isBuyer}
            onUpdate={() => {
              // Refetch trade data
              fetch(`/api/trades/${tradeId}`)
                .then(res => res.json())
                .then(data => {
                  setTrade(data.trade);
                  setBankInfo(data.bankInfo || null);
                })
                .catch(console.error);
              refetchOnchain();
            }}
          />
        </motion.div>
      </div>
    </ChainGuard>
  );
}
