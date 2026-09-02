import { requireUser, handleApiError, AuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { decryptJson } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trades/[id] — 거래 상세 (당사자만).
 * 판매자 bank_info는 구매자에게만, 그리고 status가 PENDING/AWAITING_BOND/ACTIVE/PAID일 때만 복호화.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { id } = params;

    const { data: trade } = await db()
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    if (!trade) throw new AuthError(404, 'Trade not found');

    // 당사자 확인
    const isParty =
      trade.maker_id === user.id ||
      trade.taker_id === user.id ||
      trade.seller_id === user.id ||
      trade.buyer_id === user.id;

    if (!isParty) throw new AuthError(404, 'Not found');

    // bank_info_enc 복호화 (buyer에게만, 특정 상태에서만)
    let bankInfo = null;
    if (
      trade.bank_info_enc &&
      trade.buyer_id === user.id &&
      ['PENDING', 'AWAITING_BOND', 'ACTIVE', 'PAID'].includes(trade.status)
    ) {
      bankInfo = decryptJson(trade.bank_info_enc);
    }

    // bank_info_enc 필드 제거
    const { bank_info_enc: _removed, ...tradeSafe } = trade;

    // ── DESK trades: include legs, payouts, and instructions ──
    if (trade.kind === 'DESK') {
      const { data: legs } = await db().from('custody_legs').select('*').eq('trade_id', id);
      const { data: payouts } = await db().from('custody_payouts').select('*').eq('trade_id', id);

      const { getAsset } = await import('@/lib/custody/assets');
      const { formatAmount, generateQrString } = await import('@/lib/custody/format');

      // Enrich legs with asset details and instructions
      const enrichedLegs = await Promise.all(
        (legs || []).map(async (leg: {
          id: string;
          kind: string;
          asset_id: string | null;
          owner_id: string;
          amount: string;
          amount_with_suffix: string | null;
          deposit_address: string | null;
          receive_address: string | null;
          fiat_currency: string | null;
          bank_info_enc: string | null;
          [key: string]: unknown;
        }) => {
          const { bank_info_enc: _legBankEnc, ...legSafe } = leg;
          let asset = null;
          let instructions = null;
          let legBankInfo = null;

          if (leg.kind === 'CRYPTO' && leg.asset_id) {
            const assetData = await getAsset(leg.asset_id);
            if (assetData) {
              asset = {
                symbol: assetData.symbol,
                chain_name: assetData.chain_name,
                chain_key: assetData.chain_key,
                decimals: assetData.decimals,
                explorer_tx_url: assetData.explorer_tx_url,
                min_confirmations: assetData.min_confirmations,
              };

              // Deposit instructions for caller's own leg
              if (leg.owner_id === user.id && leg.deposit_address && leg.amount_with_suffix) {
                const exactAmount = leg.amount_with_suffix;
                instructions = {
                  depositAddress: leg.deposit_address,
                  exactAmount,
                  exactAmountFormatted: formatAmount(BigInt(exactAmount), assetData.decimals),
                  qr: generateQrString(assetData.chain_key, leg.deposit_address, exactAmount, assetData.decimals),
                };
              }
            }
          }

          // FIAT leg: decrypt bank info if caller is the payer (owner)
          if (leg.kind === 'FIAT' && leg.owner_id === user.id && leg.bank_info_enc) {
            legBankInfo = decryptJson(leg.bank_info_enc);
          }

          return { ...legSafe, asset, instructions, bankInfo: legBankInfo };
        }),
      );

      // Enrich payouts with explorer URLs
      const enrichedPayouts = await Promise.all(
        (payouts || []).map(async (payout: {
          asset_id: string;
          to_address: string;
          tx_hash: string | null;
          [key: string]: unknown;
        }) => {
          let explorer_url = null;
          const assetData = await getAsset(payout.asset_id);
          if (assetData && assetData.explorer_tx_url && payout.tx_hash) {
            explorer_url = assetData.explorer_tx_url.replace('{hash}', payout.tx_hash);
          }
          return { ...payout, explorer_url };
        }),
      );

      return Response.json({
        trade: { ...tradeSafe, bankInfo },
        legs: enrichedLegs,
        payouts: enrichedPayouts,
      });
    }

    return Response.json({ trade: { ...tradeSafe, bankInfo } });
  } catch (e) {
    return handleApiError(e);
  }
}
