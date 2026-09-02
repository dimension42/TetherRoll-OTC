import { decodeEventLog, type Log } from 'viem';
import { db } from '@/lib/db';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { findToken } from '@/lib/tokens';

/**
 * EscrowVault v2 이벤트 파싱 및 DB 반영 (idempotent).
 * 인덱서와 confirm 엔드포인트에서 호출. 같은 로그 중복 적용 시 무시.
 */

type PoolStatus = 'DRAFT' | 'LOCKING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'HIDDEN';
type TradeStatus = 'PENDING' | 'AWAITING_BOND' | 'ACTIVE' | 'PAID' | 'RELEASED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'FAILED';

/** 이벤트 로그 → DB 반영. idempotent (tx hash + log index 기준 중복 체크). */
export async function applyEvent(chainId: number, log: Log): Promise<void> {
  // 중복 방지: tx hash + log index 기록 확인 (onchain_txs 테이블에서 CONFIRMED 상태로 존재하면 스킵)
  const { data: existing } = await db()
    .from('onchain_txs')
    .select('id')
    .eq('chain_id', chainId)
    .eq('hash', log.transactionHash!)
    .eq('status', 'CONFIRMED')
    .maybeSingle();

  if (existing) return; // 이미 처리됨

  try {
    const decoded = decodeEventLog({
      abi: escrowVaultAbi,
      data: log.data,
      topics: log.topics,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    switch (decoded.eventName) {
      case 'PoolCreated':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handlePoolCreated(chainId, log, decoded.args as any);
        break;
      case 'PoolTaken':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handlePoolTaken(chainId, log, decoded.args as any);
        break;
      case 'PoolCancelled':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handlePoolCancelled(chainId, log, decoded.args as any);
        break;
      case 'PoolExpired':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handlePoolExpired(chainId, log, decoded.args as any);
        break;
      case 'FiatTradeCreated':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradeCreated(chainId, log, decoded.args as any);
        break;
      case 'FiatTradeJoined':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradeJoined(chainId, log, decoded.args as any);
        break;
      case 'FiatTradePaid':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradePaid(chainId, log, decoded.args as any);
        break;
      case 'FiatTradeReleased':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradeReleased(chainId, log, decoded.args as any);
        break;
      case 'FiatTradeCancelled':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradeCancelled(chainId, log, decoded.args as any);
        break;
      case 'FiatTradeExpired':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradeExpired(chainId, log, decoded.args as any);
        break;
      case 'FiatTradeDisputed':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradeDisputed(chainId, log, decoded.args as any);
        break;
      case 'FiatTradeResolved':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleFiatTradeResolved(chainId, log, decoded.args as any);
        break;
      default:
        // 다른 이벤트는 무시 (FeesUpdated 등)
        break;
    }

    // onchain_txs CONFIRMED 기록 (중복 방지 마커)
    await db()
      .from('onchain_txs')
      .upsert(
        {
          chain_id: chainId,
          hash: log.transactionHash!,
          kind: 'event',
          status: 'CONFIRMED',
          block_number: Number(log.blockNumber),
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: 'chain_id,hash', ignoreDuplicates: true }
      );
  } catch (e) {
    console.error('applyEvent failed:', e, log);
    // 파싱 실패 등은 무시 (알 수 없는 이벤트일 수 있음)
  }
}

/** PoolCreated → pools 행 갱신 또는 생성 */
async function handlePoolCreated(chainId: number, log: Log, args: {
  poolId: bigint;
  maker: string;
  offerToken: string;
  offerAmount: bigint;
  requestToken: string;
  requestAmount: bigint;
  expiresAt: bigint;
  allowPartial: boolean;
  feeBps: number;
}) {
  const { poolId, maker, offerToken, offerAmount, requestToken, requestAmount, expiresAt, allowPartial, feeBps } = args;
  const makerLower = maker.toLowerCase();

  // 1) 이미 온체인 id로 반영된 행 (인덱서가 confirm보다 먼저 본 경우 등)
  const { data: byOnchain } = await db()
    .from('pools')
    .select('id, creator_id, status')
    .eq('chain_id', chainId)
    .eq('onchain_pool_id', Number(poolId))
    .maybeSingle();

  // 2) 클라이언트가 confirm 전에 create_tx_hash를 기록해 둔 DRAFT/LOCKING 행
  const { data: byTx } = await db()
    .from('pools')
    .select('id, creator_id, status')
    .eq('chain_id', chainId)
    .eq('create_tx_hash', log.transactionHash!)
    .in('status', ['DRAFT', 'LOCKING'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // DRAFT 행이 있고 인덱서가 만든 중복 행도 있으면 → DRAFT 행을 정본으로 삼고 중복 행을 흡수
  if (byTx && byOnchain && byOnchain.id !== byTx.id) {
    await db().from('trades').update({ pool_id: byTx.id }).eq('pool_id', byOnchain.id);
    await db().from('pools').delete().eq('id', byOnchain.id);
  }

  const existing = byTx ?? byOnchain;

  const offerTokenInfo = findToken(chainId, offerToken);
  const requestTokenInfo = findToken(chainId, requestToken);

  if (existing) {
    // 기존 행 업데이트
    await db()
      .from('pools')
      .update({
        onchain_pool_id: Number(poolId),
        offer_amount_wei: offerAmount.toString(),
        offer_remaining_wei: offerAmount.toString(),
        request_amount_wei: requestAmount.toString(),
        fee_bps: feeBps,
        maker_address: makerLower,
        offer_token: offerToken.toLowerCase(),
        request_token: requestToken.toLowerCase(),
        offer_decimals: offerTokenInfo?.decimals ?? 18,
        request_decimals: requestTokenInfo?.decimals ?? 18,
        allow_partial: allowPartial,
        status: 'OPEN' as PoolStatus,
        expires_at: new Date(Number(expiresAt) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // 온체인 직접 생성된 풀 (DB에 없음) → 신규 행 생성
    const { data: creatorUser } = await db()
      .from('user_wallets')
      .select('user_id')
      .eq('address', makerLower)
      .maybeSingle();

    await db().from('pools').insert({
      creator_id: creatorUser?.user_id ?? null,
      kind: 'SWAP',
      visibility: 'public',
      chain_id: chainId,
      onchain_pool_id: Number(poolId),
      maker_address: makerLower,
      offer_token: offerToken.toLowerCase(),
      request_token: requestToken.toLowerCase(),
      offer_decimals: offerTokenInfo?.decimals ?? 18,
      request_decimals: requestTokenInfo?.decimals ?? 18,
      offer_amount_wei: offerAmount.toString(),
      request_amount_wei: requestAmount.toString(),
      offer_remaining_wei: offerAmount.toString(),
      allow_partial: allowPartial,
      fee_bps: feeBps,
      status: 'OPEN' as PoolStatus,
      expires_at: new Date(Number(expiresAt) * 1000).toISOString(),
      create_tx_hash: log.transactionHash!,
    });
  }
}

/** PoolTaken → trades 행 생성/갱신, pools 잔량 차감 */
async function handlePoolTaken(chainId: number, log: Log, args: {
  poolId: bigint;
  taker: string;
  offerOut: bigint;
  requestIn: bigint;
  feeOffer: bigint;
  feeRequest: bigint;
  offerRemaining: bigint;
}) {
  const { poolId, taker, offerOut, requestIn, feeOffer, feeRequest, offerRemaining } = args;
  const takerLower = taker.toLowerCase();

  // pools 행 찾기
  const { data: pool } = await db()
    .from('pools')
    .select('id, creator_id, maker_address')
    .eq('chain_id', chainId)
    .eq('onchain_pool_id', Number(poolId))
    .maybeSingle();

  if (!pool) {
    console.error('PoolTaken: pool not found', chainId, poolId);
    return;
  }

  // taker 유저 ID
  const { data: takerUser } = await db()
    .from('user_wallets')
    .select('user_id')
    .eq('address', takerLower)
    .maybeSingle();

  // trades 행: 같은 tx_hash 로 이미 기록된 행(클라 PENDING 행 또는 이전 인덱싱)이 있으면 갱신, 없으면 생성 (멱등)
  const swapFields = {
    pool_id: pool.id,
    kind: 'SWAP' as const,
    chain_id: chainId,
    maker_id: pool.creator_id,
    taker_id: takerUser?.user_id ?? null,
    maker_address: pool.maker_address,
    taker_address: takerLower,
    offer_out_wei: offerOut.toString(),
    request_in_wei: requestIn.toString(),
    fee_offer_wei: feeOffer.toString(),
    fee_request_wei: feeRequest.toString(),
    status: 'CONFIRMED' as TradeStatus,
    tx_hash: log.transactionHash!,
    updated_at: new Date().toISOString(),
  };
  const { data: existingTrade } = await db()
    .from('trades')
    .select('id, status')
    .eq('chain_id', chainId)
    .eq('tx_hash', log.transactionHash!)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingTrade) {
    if (existingTrade.status === 'CONFIRMED') return; // 이미 반영됨 — 풀 잔량도 갱신 완료 상태
    await db().from('trades').update(swapFields).eq('id', existingTrade.id);
  } else {
    await db().from('trades').insert(swapFields);
  }

  // pools 잔량 차감, status 갱신
  const newStatus: PoolStatus = offerRemaining === BigInt(0) ? 'FILLED' : 'PARTIAL';

  // taken_count 증가 (읽기 + 쓰기)
  const { data: poolData } = await db().from('pools').select('taken_count').eq('id', pool.id).single();
  const newTakenCount = (poolData?.taken_count ?? 0) + 1;

  await db()
    .from('pools')
    .update({
      offer_remaining_wei: offerRemaining.toString(),
      taken_count: newTakenCount,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pool.id);
}

/** PoolCancelled → pools status CANCELLED */
async function handlePoolCancelled(chainId: number, log: Log, args: { poolId: bigint; refunded: bigint }) {
  await updatePoolStatus(chainId, Number(args.poolId), 'CANCELLED');
}

/** PoolExpired → pools status EXPIRED */
async function handlePoolExpired(chainId: number, log: Log, args: { poolId: bigint; refunded: bigint }) {
  await updatePoolStatus(chainId, Number(args.poolId), 'EXPIRED');
}

async function updatePoolStatus(chainId: number, onchainPoolId: number, status: PoolStatus) {
  await db()
    .from('pools')
    .update({ status, offer_remaining_wei: '0', updated_at: new Date().toISOString() })
    .eq('chain_id', chainId)
    .eq('onchain_pool_id', onchainPoolId);
}

/** FiatTradeCreated → trades 행 생성 또는 갱신 */
async function handleFiatTradeCreated(chainId: number, log: Log, args: {
  tradeId: bigint;
  seller: string;
  buyer: string;
  token: string;
  amount: bigint;
  bondToken: string;
  bondAmount: bigint;
  deadline: bigint;
  releaseWindow: bigint;
  feeBps: number;
}) {
  const { tradeId, seller, buyer, token, amount, bondToken, bondAmount, deadline, releaseWindow } = args;
  const sellerLower = seller.toLowerCase();
  const buyerLower = buyer.toLowerCase();

  const { data: sellerUser } = await db().from('user_wallets').select('user_id').eq('address', sellerLower).maybeSingle();
  const { data: buyerUser } = await db().from('user_wallets').select('user_id').eq('address', buyerLower).maybeSingle();

  const status: TradeStatus = bondAmount === BigInt(0) ? 'ACTIVE' : 'AWAITING_BOND';

  const fiatFields = {
    chain_id: chainId,
    onchain_trade_id: Number(tradeId),
    kind: 'FIAT' as const,
    seller_address: sellerLower,
    buyer_address: buyerLower,
    token: token.toLowerCase(),
    amount_wei: amount.toString(),
    bond_token: bondToken.toLowerCase(),
    bond_amount_wei: bondAmount.toString(),
    deadline: new Date(Number(deadline) * 1000).toISOString(),
    release_window_sec: Number(releaseWindow),
    status,
    tx_hash: log.transactionHash!,
    updated_at: new Date().toISOString(),
  };

  // 1) 온체인 id로 이미 반영된 행 → 멱등 갱신
  const { data: byOnchain } = await db()
    .from('trades')
    .select('id')
    .eq('chain_id', chainId)
    .eq('onchain_trade_id', Number(tradeId))
    .maybeSingle();
  if (byOnchain) {
    await db().from('trades').update(fiatFields).eq('id', byOnchain.id);
    return;
  }

  // 2) 클라이언트가 confirm 전에 tx_hash를 기록한 PENDING 행 (seller/buyer id, pool_id, bank_info 보존)
  const { data: byTx } = await db()
    .from('trades')
    .select('id')
    .eq('chain_id', chainId)
    .eq('tx_hash', log.transactionHash!)
    .eq('kind', 'FIAT')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byTx) {
    await db().from('trades').update(fiatFields).eq('id', byTx.id);
    return;
  }

  // 3) 온체인에서 직접 생성된 트레이드 → 신규 행
  await db().from('trades').insert({
    ...fiatFields,
    seller_id: sellerUser?.user_id ?? null,
    buyer_id: buyerUser?.user_id ?? null,
  });
}

/** FiatTradeJoined → trades bond_amount_wei 갱신, status ACTIVE */
async function handleFiatTradeJoined(chainId: number, log: Log, args: { tradeId: bigint; bondReceived: bigint }) {
  await db()
    .from('trades')
    .update({
      bond_amount_wei: args.bondReceived.toString(),
      status: 'ACTIVE' as TradeStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('chain_id', chainId)
    .eq('onchain_trade_id', Number(args.tradeId));
}

/** FiatTradePaid → trades status PAID, paid_at */
async function handleFiatTradePaid(chainId: number, log: Log, args: { tradeId: bigint }) {
  await db()
    .from('trades')
    .update({
      status: 'PAID' as TradeStatus,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('chain_id', chainId)
    .eq('onchain_trade_id', Number(args.tradeId));
}

/** FiatTradeReleased → trades status RELEASED, released_at */
async function handleFiatTradeReleased(chainId: number, log: Log, args: { tradeId: bigint; fee: bigint }) {
  await db()
    .from('trades')
    .update({
      status: 'RELEASED' as TradeStatus,
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('chain_id', chainId)
    .eq('onchain_trade_id', Number(args.tradeId));
}

/** FiatTradeCancelled → trades status CANCELLED */
async function handleFiatTradeCancelled(chainId: number, log: Log, args: { tradeId: bigint }) {
  await updateTradeStatus(chainId, Number(args.tradeId), 'CANCELLED');
}

/** FiatTradeExpired → trades status EXPIRED */
async function handleFiatTradeExpired(chainId: number, log: Log, args: { tradeId: bigint }) {
  await updateTradeStatus(chainId, Number(args.tradeId), 'EXPIRED');
}

/** FiatTradeDisputed → trades status DISPUTED, evidence_hash */
async function handleFiatTradeDisputed(chainId: number, log: Log, args: { tradeId: bigint; raisedBy: string; evidenceHash: string }) {
  await db()
    .from('trades')
    .update({
      status: 'DISPUTED' as TradeStatus,
      evidence_hash: args.evidenceHash,
      updated_at: new Date().toISOString(),
    })
    .eq('chain_id', chainId)
    .eq('onchain_trade_id', Number(args.tradeId));
}

/** FiatTradeResolved → trades status RESOLVED */
async function handleFiatTradeResolved(chainId: number, log: Log, args: { tradeId: bigint; buyerWins: boolean; amountToWinner: bigint; penalty: bigint }) {
  await updateTradeStatus(chainId, Number(args.tradeId), 'RESOLVED');
}

async function updateTradeStatus(chainId: number, onchainTradeId: number, status: TradeStatus) {
  await db()
    .from('trades')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('chain_id', chainId)
    .eq('onchain_trade_id', onchainTradeId);
}
