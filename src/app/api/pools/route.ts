import { z } from 'zod';
import { formatUnits } from 'viem';
import { requireUser, handleApiError, AuthError, getSessionUser, requireNotPaused } from '@/lib/auth/guards';
import { parseBody, parseQuery, zAddress, zBigIntStr, zChainId } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { findToken, FIAT_CURRENCIES } from '@/lib/tokens';
import { isChainDeployed } from '@/lib/contracts/addresses';

/**
 * 풀 API v2 (온체인 연동).
 *
 * 저장 규약 (B-01 확정):
 *  - SWAP            : offer_token / request_token 둘 다 컨트랙트 주소(0x0 = 네이티브). *_amount_wei 는 토큰 최소단위.
 *  - FIAT CRYPTO_FIAT: offer = 크립토 토큰(offer_token, offer_amount_wei), request = fiat (request_symbol = 'KRW', request_amount = 원화 정수)
 *  - FIAT FIAT_CRYPTO: offer = fiat (offer_symbol = 'KRW', offer_amount = 원화 정수), request = 크립토 토큰(request_token, request_amount_wei)
 *  - 레거시 표시 컬럼(offer_symbol/offer_amount/request_symbol/request_amount)은 사람이 읽는 값으로 항상 함께 채운다.
 *
 * 상태: SWAP 은 DRAFT → (클라 createPool tx) → LOCKING → confirm/인덱서 → OPEN.
 *       FIAT 풀은 오프체인 광고이므로 생성 즉시 OPEN (온체인 락은 트레이드 단위로 발생).
 */

const LIST_STATUSES = ['OPEN', 'PARTIAL', 'FILLED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'MATCHED'] as const;
const PAGE_SIZE = 50;

const getPoolsSchema = z.object({
  scope: z.enum(['public', 'vip']).optional(),
  status: z.enum(LIST_STATUSES).optional(),
  chainId: z.number().int().optional(),
  cursor: z.string().datetime({ offset: true }).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { scope, status, chainId, cursor } = parseQuery(url, getPoolsSchema);

    const user = await getSessionUser();
    const isVip =
      user?.vip_status === 'approved' && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

    let query = db()
      .from('pools')
      .select('*')
      .not('status', 'in', '(HIDDEN,DRAFT,LOCKING)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (scope === 'vip') {
      if (!isVip) throw new AuthError(404, 'Not found');
      query = query.eq('visibility', 'vip');
    } else {
      query = query.eq('visibility', 'public');
    }

    if (status) query = query.eq('status', status);
    if (chainId) query = query.eq('chain_id', chainId);

    // B-06: 만료된 OPEN/PARTIAL 풀은 목록에서 제외 (DB 상태 갱신은 cron/expire 가 담당)
    const now = new Date().toISOString();
    query = query.or(`expires_at.is.null,expires_at.gt.${now},status.not.in.(OPEN,PARTIAL)`);

    if (cursor) query = query.lt('created_at', cursor);

    const { data, error } = await query;
    if (error) throw error;

    const pools = data ?? [];
    const nextCursor = pools.length === PAGE_SIZE ? pools[pools.length - 1].created_at : null;
    return Response.json({ pools, nextCursor });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/pools — 풀 생성.
 * SWAP : { chainId, kind:'SWAP', offerToken, offerAmount(wei), requestToken, requestAmount(wei), expiresAt, allowPartial, visibility? }
 * FIAT : { chainId, kind:'FIAT', tradeType?:'CRYPTO_FIAT'|'FIAT_CRYPTO', fiatCurrency:'KRW',
 *          offerToken+offerAmount(wei) (크립토 판매) 또는 requestToken+requestAmount(wei) (크립토 매수),
 *          fiatAmount(원화 정수 문자열), expiresAt, allowPartial, collateralMode?, collateralPct? }
 *        (하위호환: fiatAmount 대신 CRYPTO_FIAT 은 requestAmount, FIAT_CRYPTO 는 offerAmount 에 원화를 넣어도 됨)
 */
const createPoolSchema = z.object({
  chainId: zChainId,
  kind: z.enum(['SWAP', 'FIAT']),
  tradeType: z.enum(['CRYPTO_FIAT', 'FIAT_CRYPTO']).optional(),
  offerToken: zAddress.optional(),
  offerAmount: zBigIntStr.optional(),
  requestToken: zAddress.optional(),
  requestAmount: zBigIntStr.optional(),
  fiatCurrency: z.string().min(3).max(3).optional(),
  fiatAmount: zBigIntStr.optional(),
  expiresAt: z.string().datetime({ offset: true }),
  allowPartial: z.boolean().default(true),
  visibility: z.enum(['public', 'vip']).optional(),
  collateralMode: z.enum(['NONE', 'KRW_SIDE_LOCKS']).optional(),
  collateralPct: z.number().int().min(10).max(100).optional(),
});

const MAX_POOL_DURATION_MS = 30 * 24 * 3600 * 1000;

function humanAmount(wei: string, decimals: number): number {
  return Number(formatUnits(BigInt(wei), decimals));
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await requireNotPaused();
    await rateLimitByUser(user.id, 'pool_create', 30, 3600);

    const body = await parseBody(req, createPoolSchema);
    const { chainId, kind, expiresAt, allowPartial } = body;

    const exp = new Date(expiresAt);
    if (exp <= new Date()) throw new AuthError(400, 'expiresAt must be in the future');
    if (exp.getTime() - Date.now() > MAX_POOL_DURATION_MS) throw new AuthError(400, 'expiresAt exceeds 30 days');

    // maker 지갑 (온체인 주체) — primary 지갑
    const { data: wallets } = await db().from('user_wallets').select('address, is_primary').eq('user_id', user.id);
    const makerAddress =
      wallets?.find((w: { is_primary: boolean }) => w.is_primary)?.address ?? wallets?.[0]?.address ?? null;
    if (!makerAddress) throw new AuthError(400, 'Link a wallet before creating a pool');

    const isVip =
      user.vip_status === 'approved' && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

    // ── SWAP ──
    if (kind === 'SWAP') {
      const { offerToken, offerAmount, requestToken, requestAmount } = body;
      if (!offerToken || !requestToken || !offerAmount || !requestAmount) {
        throw new AuthError(400, 'offerToken/offerAmount/requestToken/requestAmount required');
      }
      if (offerToken === requestToken) throw new AuthError(400, 'Cannot swap the same token');
      if (BigInt(offerAmount) === 0n || BigInt(requestAmount) === 0n) throw new AuthError(400, 'Amounts must be > 0');
      if (!isChainDeployed(chainId)) throw new AuthError(400, 'EscrowVault is not deployed on this chain');

      const offerInfo = findToken(chainId, offerToken);
      const requestInfo = findToken(chainId, requestToken);
      if (!offerInfo || !requestInfo) throw new AuthError(400, 'Token not whitelisted on this chain');

      const visibility = body.visibility === 'vip' ? (isVip ? 'vip' : null) : 'public';
      if (!visibility) throw new AuthError(404, 'Not found');

      const { data, error } = await db()
        .from('pools')
        .insert({
          creator_id: user.id,
          kind: 'SWAP',
          visibility,
          trade_type: 'CRYPTO_CRYPTO',
          chain_id: chainId,
          maker_address: makerAddress,
          offer_token: offerToken,
          request_token: requestToken,
          offer_symbol: offerInfo.symbol,
          request_symbol: requestInfo.symbol,
          offer_decimals: offerInfo.decimals,
          request_decimals: requestInfo.decimals,
          offer_amount_wei: offerAmount,
          request_amount_wei: requestAmount,
          offer_remaining_wei: offerAmount,
          offer_amount: humanAmount(offerAmount, offerInfo.decimals),
          request_amount: humanAmount(requestAmount, requestInfo.decimals),
          allow_partial: allowPartial,
          status: 'DRAFT',
          expires_at: exp.toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      return Response.json({ id: data.id, status: 'DRAFT' });
    }

    // ── FIAT (VIP 전용, 존재 은닉) ──
    if (!isVip) throw new AuthError(404, 'Not found');

    const fiatCurrency = (body.fiatCurrency ?? 'KRW').toUpperCase();
    if (!FIAT_CURRENCIES.some(c => c.code === fiatCurrency)) throw new AuthError(400, 'Unsupported fiat currency');

    // 방향 결정: 명시된 tradeType > 어느 쪽에 토큰이 있는지
    const tradeType: 'CRYPTO_FIAT' | 'FIAT_CRYPTO' =
      body.tradeType ?? (body.offerToken ? 'CRYPTO_FIAT' : body.requestToken ? 'FIAT_CRYPTO' : 'CRYPTO_FIAT');

    const cryptoToken = tradeType === 'CRYPTO_FIAT' ? body.offerToken : body.requestToken;
    const cryptoAmount = tradeType === 'CRYPTO_FIAT' ? body.offerAmount : body.requestAmount;
    const fiatAmount = body.fiatAmount ?? (tradeType === 'CRYPTO_FIAT' ? body.requestAmount : body.offerAmount);
    if (!cryptoToken || !cryptoAmount || !fiatAmount) {
      throw new AuthError(400, 'Crypto token/amount and fiat amount required');
    }
    if (BigInt(cryptoAmount) === 0n || BigInt(fiatAmount) === 0n) throw new AuthError(400, 'Amounts must be > 0');
    const tokenInfo = findToken(chainId, cryptoToken);
    if (!tokenInfo) throw new AuthError(400, 'Token not whitelisted on this chain');

    const collateralMode = body.collateralMode ?? 'NONE';
    const collateralPct = collateralMode === 'KRW_SIDE_LOCKS' ? body.collateralPct : null;
    if (collateralMode === 'KRW_SIDE_LOCKS' && !collateralPct) throw new AuthError(400, 'collateralPct required');

    const cryptoHuman = humanAmount(cryptoAmount, tokenInfo.decimals);
    const fiatHuman = Number(fiatAmount);
    const isSell = tradeType === 'CRYPTO_FIAT';

    const { data, error } = await db()
      .from('pools')
      .insert({
        creator_id: user.id,
        kind: 'FIAT',
        visibility: 'vip',
        trade_type: tradeType,
        chain_id: chainId,
        maker_address: makerAddress,
        fiat_currency: fiatCurrency,
        offer_token: isSell ? cryptoToken : null,
        request_token: isSell ? null : cryptoToken,
        offer_symbol: isSell ? tokenInfo.symbol : fiatCurrency,
        request_symbol: isSell ? fiatCurrency : tokenInfo.symbol,
        offer_decimals: isSell ? tokenInfo.decimals : 0,
        request_decimals: isSell ? 0 : tokenInfo.decimals,
        offer_amount_wei: isSell ? cryptoAmount : fiatAmount,
        request_amount_wei: isSell ? fiatAmount : cryptoAmount,
        offer_remaining_wei: isSell ? cryptoAmount : fiatAmount,
        offer_amount: isSell ? cryptoHuman : fiatHuman,
        request_amount: isSell ? fiatHuman : cryptoHuman,
        collateral_mode: collateralMode,
        collateral_pct: collateralPct,
        allow_partial: allowPartial,
        status: 'OPEN',
        expires_at: exp.toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;
    return Response.json({ id: data.id, status: 'OPEN' });
  } catch (e) {
    return handleApiError(e);
  }
}
