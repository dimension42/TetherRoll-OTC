'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { type DeskPool, type CustodyAsset } from './types';
import { fmtAmount } from '@/lib/format';

/**
 * RequestDeskTrade — Panel on pool detail page to request a DESK trade
 * User inputs: amount (partial if allowed), receive address (crypto), refund address (crypto deposit), bank info (KRW receive)
 */
export function RequestDeskTrade({ pool }: { pool: DeskPool }) {
  const router = useRouter();
  const { authenticated, login } = useAuth();

  const [assets, setAssets] = useState<CustodyAsset[]>([]);
  const [amount, setAmount] = useState('');
  const [receiveAddress, setReceiveAddress] = useState('');
  const [refundAddress, setRefundAddress] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load custody assets to get address validation regex
    fetch('/api/custody/assets')
      .then(res => res.ok ? res.json() : Promise.reject('Failed to load assets'))
      .then(data => setAssets(data.assets || []))
      .catch(console.error);
  }, []);

  const handleSubmit = async () => {
    setError(null);

    if (!authenticated) {
      login();
      return;
    }

    // Validation
    if (pool.allow_partial) {
      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount');
        return;
      }
      const amtBig = BigInt(Math.floor(parseFloat(amount) * 10 ** (pool.offer_decimals || 0)));
      const maxBig = BigInt(pool.offer_amount_wei || '0');
      if (amtBig > maxBig) {
        setError('Amount exceeds pool offer');
        return;
      }
    }

    // If I receive crypto (pool.trade_type CRYPTO_FIAT or CRYPTO_CRYPTO on the request side), I need receiveAddress
    const iReceiveCrypto = pool.trade_type === 'CRYPTO_FIAT' || (pool.trade_type === 'CRYPTO_CRYPTO' && pool.request_asset_id);
    if (iReceiveCrypto && !receiveAddress.trim()) {
      setError('Please enter your receive address (where you will receive crypto)');
      return;
    }

    // If I deposit crypto (pool.trade_type FIAT_CRYPTO or CRYPTO_CRYPTO on the offer side), I need refundAddress
    const iDepositCrypto = pool.trade_type === 'FIAT_CRYPTO' || (pool.trade_type === 'CRYPTO_CRYPTO' && pool.offer_asset_id);
    if (iDepositCrypto && !refundAddress.trim()) {
      setError('Please enter your refund address (where you will get refunded if needed)');
      return;
    }

    // If I receive KRW, I need bank info
    const iReceiveKRW = pool.trade_type === 'CRYPTO_FIAT' && pool.fiat_currency === 'KRW';
    if (iReceiveKRW) {
      if (!bank.trim() || !account.trim() || !holder.trim()) {
        setError('Please enter your bank account info to receive KRW');
        return;
      }
    }

    // Address validation (basic regex check)
    if (iReceiveCrypto && receiveAddress.trim()) {
      const requestAsset = assets.find(a => a.id === pool.request_asset_id);
      if (requestAsset?.address_regex) {
        const regex = new RegExp(requestAsset.address_regex);
        if (!regex.test(receiveAddress.trim())) {
          setError(`Invalid ${requestAsset.chain_name} address format`);
          return;
        }
      }
    }

    if (iDepositCrypto && refundAddress.trim()) {
      const offerAsset = assets.find(a => a.id === pool.offer_asset_id);
      if (offerAsset?.address_regex) {
        const regex = new RegExp(offerAsset.address_regex);
        if (!regex.test(refundAddress.trim())) {
          setError(`Invalid ${offerAsset.chain_name} address format`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const body: Record<string, unknown> = { poolId: pool.id };

      if (pool.allow_partial && amount) {
        const amtWei = BigInt(Math.floor(parseFloat(amount) * 10 ** (pool.offer_decimals || 0))).toString();
        body.amount = amtWei;
      }

      if (iReceiveCrypto && receiveAddress.trim()) {
        body.receiveAddress = receiveAddress.trim();
      }

      if (iDepositCrypto && refundAddress.trim()) {
        body.refundAddress = refundAddress.trim();
      }

      if (iReceiveKRW) {
        body.bankInfo = { bank, account, holder };
      }

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      const { id } = await res.json();
      router.push(`/trades/${id}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create trade');
    } finally {
      setSubmitting(false);
    }
  };

  if (pool.status !== 'OPEN') {
    return (
      <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
        <p className="text-sm" style={{ color: '#888' }}>This pool is no longer accepting trades.</p>
      </div>
    );
  }

  const offerDisplay = pool.trade_type === 'FIAT_CRYPTO'
    ? `₩${parseFloat(String(pool.offer_amount_wei || '0')).toLocaleString('ko-KR')}`
    : fmtAmount(pool.offer_amount_wei || '0', pool.offer_decimals || 18);

  const iReceiveCrypto = pool.trade_type === 'CRYPTO_FIAT' || (pool.trade_type === 'CRYPTO_CRYPTO' && pool.request_asset_id);
  const iDepositCrypto = pool.trade_type === 'FIAT_CRYPTO' || (pool.trade_type === 'CRYPTO_CRYPTO' && pool.offer_asset_id);
  const iReceiveKRW = pool.trade_type === 'CRYPTO_FIAT' && pool.fiat_currency === 'KRW';

  return (
    <div className="p-6 rounded-2xl" style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}>
      <h3 className="text-lg font-bold text-white mb-4">Request Trade</h3>

      <div className="space-y-4">
        {/* Explanation */}
        <div className="p-4 rounded-xl text-xs" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', color: '#a78bfa' }}>
          {pool.trade_type === 'CRYPTO_CRYPTO' && (
            <p>
              You send <strong>{pool.offer_symbol}</strong> to the platform address. Counterparty sends <strong>{pool.request_symbol}</strong>. Platform pays out when both confirmed.
            </p>
          )}
          {pool.trade_type === 'CRYPTO_FIAT' && (
            <p>
              You send <strong>{pool.offer_symbol}</strong> to the platform address. Counterparty sends <strong>{pool.fiat_currency}</strong> to your bank. Platform releases crypto when confirmed.
            </p>
          )}
          {pool.trade_type === 'FIAT_CRYPTO' && (
            <p>
              You send <strong>{pool.fiat_currency}</strong> to counterparty&apos;s bank. Counterparty sends <strong>{pool.request_symbol}</strong> to platform. Platform releases crypto to you when confirmed.
            </p>
          )}
        </div>

        {/* Amount (partial) */}
        {pool.allow_partial && (
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#888' }}>
              Amount (partial fill allowed, max: {offerDisplay} {pool.offer_symbol})
            </label>
            <input
              type="number"
              step="any"
              className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              placeholder="0.0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        )}

        {!pool.allow_partial && (
          <div className="p-3 rounded-lg" style={{ background: '#050806' }}>
            <p className="text-xs" style={{ color: '#888' }}>
              Full amount only: <span className="font-mono font-semibold text-white">{offerDisplay} {pool.offer_symbol}</span>
            </p>
          </div>
        )}

        {/* Receive Address (crypto) */}
        {iReceiveCrypto && (
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#888' }}>
              Your Receive Address ({pool.request_symbol}, where you will receive crypto)
            </label>
            <input
              type="text"
              className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              placeholder="0x... or native address"
              value={receiveAddress}
              onChange={e => setReceiveAddress(e.target.value)}
            />
          </div>
        )}

        {/* Refund Address (crypto) */}
        {iDepositCrypto && (
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#888' }}>
              Your Refund Address ({pool.offer_symbol}, where you will get refunded if trade fails)
            </label>
            <input
              type="text"
              className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              placeholder="0x... or native address"
              value={refundAddress}
              onChange={e => setRefundAddress(e.target.value)}
            />
          </div>
        )}

        {/* Bank Info (KRW receive) */}
        {iReceiveKRW && (
          <div className="space-y-3">
            <p className="text-xs font-semibold" style={{ color: '#888' }}>
              Your Bank Account (to receive KRW)
            </p>
            <input
              type="text"
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              placeholder="Bank name (e.g. 신한은행)"
              value={bank}
              onChange={e => setBank(e.target.value)}
            />
            <input
              type="text"
              className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              placeholder="Account number"
              value={account}
              onChange={e => setAccount(e.target.value)}
            />
            <input
              type="text"
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{ background: '#050806', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              placeholder="Account holder name"
              value={holder}
              onChange={e => setHolder(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg" style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.2)' }}>
            <p className="text-xs" style={{ color: '#ff4466' }}>⚠️ {error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full px-6 py-3 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: submitting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00c9a7, #00a88a)',
            color: submitting ? '#555' : '#000',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Creating Trade...' : authenticated ? 'Request Trade' : 'Sign In to Trade'}
        </button>
      </div>
    </div>
  );
}
