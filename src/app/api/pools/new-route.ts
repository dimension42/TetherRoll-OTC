/**
 * NEW pools API (v2 — 온체인 연동).
 * 기존 route.ts는 legacy 0001 schema. 이 파일로 교체 예정.
 *
 * GET /api/pools?scope=public|vip&status=&chainId=&cursor=
 * POST /api/pools { chainId, kind:'SWAP'|'FIAT', offerToken, offerAmount(bigint str), requestToken|fiatCurrency, requestAmount, expiresAt, allowPartial, visibility, ... }
 * GET /api/pools/mine
 * GET /api/pools/[id] (includes trades where user is party)
 * POST /api/pools/[id]/confirm { txHash }
 * POST /api/pools/[id]/cancel
 */

import { z } from 'zod';
import { requireUser, handleApiError, AuthError, getSessionUser, requireNotPaused } from '@/lib/auth/guards';
import { parseBody, parseQuery, zBigIntStr, zChainId } from '@/lib/validate';
import { rateLimitByUser } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { findToken, FIAT_CURRENCIES } from '@/lib/tokens';

const getPoolsSchema = z.object({
  scope: z.enum(['public', 'vip']).optional(),
  status: z.string().optional(),
  chainId: z.number().optional(),
  cursor: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { scope, status, chainId, cursor } = parseQuery(url, getPoolsSchema);

    const user = await getSessionUser();
    const isVip = user?.vip_status === 'approved' && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

    let query = db()
      .from('pools')
      .select('*')
      .neq('status', 'HIDDEN')
      .order('created_at', { ascending: false })
      .limit(50);

    if (scope === 'vip') {
      if (!isVip) throw new AuthError(404, 'Not found');
      query = query.eq('visibility', 'vip');
    } else {
      query = query.eq('visibility', 'public');
    }

    if (status) query = query.eq('status', status);
    if (chainId) query = query.eq('chain_id', chainId);

    // B-06: 만료 제외 (expires_at > now 또는 status not in OPEN/PARTIAL)
    const now = new Date().toISOString();
    query = query.or(`expires_at.is.null,expires_at.gt.${now},status.not.in.(OPEN,PARTIAL)`);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ pools: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/pools — 풀 생성 (DB DRAFT 행 + 클라이언트가 온체인 락 후 confirm) */
const createPoolSchema = z.object({
  chainId: zChainId,
  kind: z.enum(['SWAP', 'FIAT']),
  offerToken: zAddress.optional(),
  offerAmount: zBigIntStr,
  requestToken: zAddress.optional(),
  fiatCurrency: z.string().optional(),
  requestAmount: zBigIntStr,
  expiresAt: z.string(), // ISO timestamp
  allowPartial: z.boolean(),
  visibility: z.enum(['public', 'vip']),
  // FIAT only
  collateralMode: z.enum(['NONE', 'KRW_SIDE_LOCKS']).optional(),
  collateralPct: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await requireNotPaused();
    await rateLimitByUser(user.id, 'pool_create', 30, 3600); // 30/hour

    const body = await parseBody(req, createPoolSchema);
    const { chainId, kind, offerToken, offerAmount, requestToken, fiatCurrency, requestAmount, expiresAt, allowPartial, visibility } = body;

    // B-01 fix: FIAT 풀에서 fiat side는 fiatCurrency, crypto side만 token
    if (kind === 'FIAT') {
      if (!fiatCurrency || !FIAT_CURRENCIES.some(c => c.code === fiatCurrency.toUpperCase())) {
        throw new AuthError(400, 'Invalid fiatCurrency');
      }
      // VIP 전용
      if (user.vip_status !== 'approved' || (user.vip_expires_at && new Date(user.vip_expires_at) < new Date())) {
        throw new AuthError(404, 'Not found');
      }
    }

    if (kind === 'SWAP') {
      if (!offerToken || !requestToken) throw new AuthError(400, 'Missing token addresses');
      if (offerToken === requestToken) throw new AuthError(400, 'Cannot swap same token');
      // 토큰 화이트리스트 검증
      const offerInfo = findToken(chainId, offerToken);
      const requestInfo = findToken(chainId, requestToken);
      if (!offerInfo || !requestInfo) throw new AuthError(400, 'Token not whitelisted');
    }

    // expires_at 검증
    const exp = new Date(expiresAt);
    if (exp <= new Date()) throw new AuthError(400, 'expiresAt must be future');

    // DB DRAFT 행 생성
    const { data, error } = await db()
      .from('pools')
      .insert({
        creator_id: user.id,
        kind,
        visibility,
        chain_id: chainId,
        offer_token: offerToken?.toLowerCase() ?? null,
        request_token: requestToken?.toLowerCase() ?? null,
        offer_amount_wei: offerAmount,
        request_amount_wei: requestAmount,
        fiat_currency: fiatCurrency?.toUpperCase() ?? null,
        allow_partial: allowPartial,
        status: 'DRAFT',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (error) throw error;

    return Response.json({ id: data.id, status: 'DRAFT' });
  } catch (e) {
    return handleApiError(e);
  }
}
