import { z } from 'zod';
import { requireUser, handleApiError, AuthError, requireNotPaused } from '@/lib/auth/guards';
import { parseBody, zBigIntStr } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { encryptJson } from '@/lib/crypto';

/**
 * POST /api/trades — 거래 생성 (SWAP 또는 FIAT).
 * SWAP: { poolId, offerWanted, takerAddress? } → PENDING (클라가 take() 전송)
 * FIAT: { poolId, fiatAmount?, bankInfo:{bank,account,holder}, counterpartyAddress? } → PENDING
 */
const createTradeSchema = z.object({
  poolId: z.string().uuid(),
  // SWAP
  offerWanted: zBigIntStr.optional(),
  takerAddress: z.string().optional(),
  // FIAT
  fiatAmount: z.string().optional(), // bigint string
  bankInfo: z.object({
    bank: z.string(),
    account: z.string(),
    holder: z.string(),
  }).optional(),
  counterpartyAddress: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await requireNotPaused();
    await rateLimitByUser(user.id, 'trade_create', 30, 3600);

    const body = await parseBody(req, createTradeSchema);
    const { poolId, offerWanted, takerAddress, fiatAmount, bankInfo } = body;

    const { data: pool } = await db()
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .in('status', ['OPEN', 'PARTIAL'])
      .single();

    if (!pool) throw new AuthError(404, 'Pool not available');

    // 유저의 primary wallet 또는 지정된 주소
    const { data: wallets } = await db()
      .from('user_wallets')
      .select('address, is_primary')
      .eq('user_id', user.id);

    if (!wallets || wallets.length === 0) throw new AuthError(400, 'No wallet linked');

    const primaryWallet = wallets.find((w: { is_primary: boolean }) => w.is_primary)?.address ?? wallets[0].address;
    const userWalletAddr = takerAddress ?? primaryWallet;

    // 지정 주소가 내 지갑 중 하나인지 확인
    if (takerAddress && !wallets.some((w: { address: string }) => w.address.toLowerCase() === takerAddress.toLowerCase())) {
      throw new AuthError(403, 'takerAddress not your wallet');
    }

    if (pool.kind === 'SWAP') {
      if (!offerWanted) throw new AuthError(400, 'offerWanted required for SWAP');

      const { data, error } = await db()
        .from('trades')
        .insert({
          pool_id: poolId,
          kind: 'SWAP',
          chain_id: pool.chain_id,
          maker_id: pool.creator_id,
          taker_id: user.id,
          maker_address: pool.maker_address,
          taker_address: userWalletAddr.toLowerCase(),
          status: 'PENDING',
        })
        .select('id')
        .single();

      if (error) throw error;
      return Response.json({ id: data.id, status: 'PENDING' });
    }

    if (pool.kind === 'FIAT') {
      if (!bankInfo) throw new AuthError(400, 'bankInfo required for FIAT');

      // FIAT pool의 trade_type (legacy field)에서 seller/buyer 결정
      // CRYPTO_FIAT: pool creator = seller (crypto), caller = buyer (KRW)
      // FIAT_CRYPTO: caller = seller (KRW), pool creator = buyer (crypto)
      let sellerId = pool.creator_id;
      let buyerId = user.id;
      let sellerAddr = pool.maker_address;
      let buyerAddr = userWalletAddr.toLowerCase();

      if (pool.trade_type === 'FIAT_CRYPTO') {
        sellerId = user.id;
        buyerId = pool.creator_id;
        sellerAddr = userWalletAddr.toLowerCase();
        buyerAddr = pool.maker_address;
      }

      // bankInfo 암호화 (seller의 계좌)
      const bankInfoEnc = encryptJson(bankInfo);

      // fiat_amount 계산 (부분 체결 허용이면 pro-rata)
      const poolFiatAmount = pool.fiat_currency ? pool.request_amount_wei : pool.offer_amount_wei;
      const tradeFiatAmount = fiatAmount ?? poolFiatAmount;

      const { data, error } = await db()
        .from('trades')
        .insert({
          pool_id: poolId,
          kind: 'FIAT',
          chain_id: pool.chain_id,
          seller_id: sellerId,
          buyer_id: buyerId,
          seller_address: sellerAddr,
          buyer_address: buyerAddr,
          token: pool.offer_token ?? pool.request_token,
          fiat_currency: pool.fiat_currency,
          fiat_amount: tradeFiatAmount,
          bank_info_enc: bankInfoEnc,
          status: 'PENDING',
        })
        .select('id')
        .single();

      if (error) throw error;
      return Response.json({ id: data.id, status: 'PENDING' });
    }

    throw new AuthError(400, 'Unknown pool kind');
  } catch (e) {
    return handleApiError(e);
  }
}
