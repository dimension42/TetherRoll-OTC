import { db } from '@/lib/db';
import { getSessionUser, requireUser, handleApiError } from '@/lib/auth/guards';

/**
 * GET /api/pools — 풀 목록.
 * VIP 미승인 계정에는 fiat(vip) 풀이 응답에서 아예 제외된다 (서버 레벨 분리, PRD §2.1).
 */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    const isVip = user?.vip_status === 'approved' &&
      (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

    const url = new URL(req.url);
    const scope = url.searchParams.get('scope');

    let query = db()
      .from('pools')
      .select('id, visibility, trade_type, offer_symbol, offer_chain, offer_amount, request_symbol, request_chain, request_amount, fiat_currency, collateral_mode, collateral_pct, status, filled_pct, chain_id, expires_at, created_at')
      .neq('status', 'HIDDEN')
      .order('created_at', { ascending: false })
      .limit(100);

    if (scope === 'vip') {
      if (!isVip) return Response.json({ error: 'Not found' }, { status: 404 });
      query = query.eq('visibility', 'vip');
    } else {
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ pools: data });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/pools — 풀 생성.
 * CRYPTO_CRYPTO는 public, fiat 관련은 VIP 전용(미승인 유저에게는 404로 숨김).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = await req.json();
    const {
      tradeType,
      offerSymbol,
      offerChain,
      offerAmount,
      requestSymbol,
      requestChain,
      requestAmount,
      fiatCurrency,
      collateralMode,
      collateralPct,
      expiresAt,
    } = body;

    // 기본 검증
    if (!tradeType || !['CRYPTO_CRYPTO', 'CRYPTO_FIAT', 'FIAT_CRYPTO'].includes(tradeType)) {
      return Response.json({ error: 'Invalid tradeType' }, { status: 400 });
    }

    // 금액 검증
    const offerAmt = Number(offerAmount);
    const requestAmt = Number(requestAmount);
    if (!Number.isFinite(offerAmt) || offerAmt <= 0 || !Number.isFinite(requestAmt) || requestAmt <= 0) {
      return Response.json({ error: 'Invalid amounts' }, { status: 400 });
    }

    // 심볼 검증 (1~10자 영대문자)
    const symbolRegex = /^[A-Z]{1,10}$/;
    if (!symbolRegex.test(offerSymbol) || !symbolRegex.test(requestSymbol)) {
      return Response.json({ error: 'Invalid symbol format' }, { status: 400 });
    }

    // expiresAt 검증 (미래 시각)
    if (expiresAt) {
      const exp = new Date(expiresAt);
      if (exp <= new Date()) {
        return Response.json({ error: 'expiresAt must be in the future' }, { status: 400 });
      }
    }

    // fiat 풀인 경우 VIP 전용
    const isFiat = tradeType !== 'CRYPTO_CRYPTO';
    let visibility: 'public' | 'vip' = 'public';
    let finalFiatCurrency: string | null = null;
    let finalCollateralMode: 'NONE' | 'KRW_SIDE_LOCKS' = 'NONE';
    let finalCollateralPct: number | null = null;

    if (isFiat) {
      // VIP 승인 여부 체크
      const isVip = user.vip_status === 'approved' &&
        (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date());

      if (!isVip) {
        // 미승인 유저에게는 fiat 풀 생성 불가(존재 은닉)
        return Response.json({ error: 'Not found' }, { status: 404 });
      }

      visibility = 'vip';

      // fiatCurrency 필수
      if (!fiatCurrency || typeof fiatCurrency !== 'string' || fiatCurrency.length !== 3) {
        return Response.json({ error: 'Invalid fiatCurrency' }, { status: 400 });
      }
      finalFiatCurrency = fiatCurrency.toUpperCase();

      // collateral 처리
      if (collateralMode === 'KRW_SIDE_LOCKS') {
        finalCollateralMode = 'KRW_SIDE_LOCKS';
        const pct = Number(collateralPct);
        if (!Number.isInteger(pct) || pct < 10 || pct > 100) {
          return Response.json({ error: 'collateralPct must be 10~100' }, { status: 400 });
        }
        finalCollateralPct = pct;
      }
    }

    // DB 삽입
    const { data, error } = await db()
      .from('pools')
      .insert({
        creator_id: user.id,
        visibility,
        trade_type: tradeType,
        offer_symbol: offerSymbol.toUpperCase(),
        offer_chain: offerChain || null,
        offer_amount: offerAmt,
        request_symbol: requestSymbol.toUpperCase(),
        request_chain: requestChain || null,
        request_amount: requestAmt,
        fiat_currency: finalFiatCurrency,
        collateral_mode: finalCollateralMode,
        collateral_pct: finalCollateralPct,
        status: 'OPEN',
        filled_pct: 0,
        expires_at: expiresAt || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    return Response.json({ ok: true, id: data.id });
  } catch (e) {
    return handleApiError(e);
  }
}
