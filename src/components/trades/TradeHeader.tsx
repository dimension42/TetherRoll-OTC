import { type Trade, type TradeStatus } from '@/lib/types';
import { StatusChip } from '@/components/ui/StatusChip';
import { AddressLink } from '@/components/ui/AddressLink';
import { shortAddr, fmtAmount, fmtKrw } from '@/lib/format';
import { findToken } from '@/lib/tokens';

export function TradeHeader({
  trade,
  effectiveStatus,
  isSeller,
  chainMeta,
}: {
  trade: Trade;
  effectiveStatus: TradeStatus;
  isSeller: boolean;
  isBuyer: boolean;
  chainMeta: { name: string; short: string };
}) {
  const token = findToken(trade.chain_id, trade.token ?? '');
  const bondToken = findToken(trade.chain_id, trade.bond_token ?? '');

  return (
    <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">
              Trade {shortAddr(trade.id, 8, 6)}
            </h1>
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              {chainMeta.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={effectiveStatus} type="trade" />
            <span className="text-sm" style={{ color: '#666' }}>•</span>
            <span className="text-sm font-semibold" style={{ color: isSeller ? '#00c9a7' : '#60a5fa' }}>
              You are the {isSeller ? 'Seller' : 'Buyer'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Counterparty */}
        <div>
          <p className="text-xs uppercase mb-2" style={{ color: '#666' }}>
            {isSeller ? 'Buyer' : 'Seller'}
          </p>
          {(isSeller ? trade.buyer_address : trade.seller_address) && (
            <AddressLink
              address={(isSeller ? trade.buyer_address : trade.seller_address)!}
              chainId={trade.chain_id}
            />
          )}
        </div>

        {/* Crypto Amount */}
        <div>
          <p className="text-xs uppercase mb-2" style={{ color: '#666' }}>
            {isSeller ? 'Selling' : 'Buying'}
          </p>
          <p className="text-lg font-mono font-semibold text-white">
            {trade.amount_wei
              ? fmtAmount(trade.amount_wei, token?.decimals || 18)
              : '—'}{' '}
            {token?.symbol || 'Unknown'}
          </p>
        </div>

        {/* Fiat Amount */}
        <div>
          <p className="text-xs uppercase mb-2" style={{ color: '#666' }}>
            KRW Amount
          </p>
          <p className="text-lg font-mono font-semibold" style={{ color: '#00c9a7' }}>
            {trade.fiat_amount ? fmtKrw(trade.fiat_amount) : '—'}
          </p>
        </div>

        {/* Bond Requirement */}
        {trade.bond_amount_wei && BigInt(trade.bond_amount_wei) > BigInt(0) && (
          <div>
            <p className="text-xs uppercase mb-2" style={{ color: '#666' }}>
              Buyer Bond
            </p>
            <p className="text-lg font-mono font-semibold" style={{ color: '#f5a623' }}>
              {fmtAmount(trade.bond_amount_wei, bondToken?.decimals || 18)}{' '}
              {bondToken?.symbol || 'Unknown'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
