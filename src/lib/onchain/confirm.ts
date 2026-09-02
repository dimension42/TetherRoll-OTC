import { type Log } from 'viem';
import { AuthError } from '@/lib/auth/guards';
import { publicClientFor, escrowContract } from '@/lib/onchain/client';
import { applyEvent } from '@/lib/onchain/events';
import { db } from '@/lib/db';
import type { AppUser } from '@/lib/auth/guards';

/**
 * 트랜잭션 확인 — 유저가 전송한 tx의 receipt 조회 + 이벤트 파싱 + DB 반영.
 * Pending이면 { status: 'PENDING' } (HTTP 202로 응답), 성공이면 디코딩된 이벤트 args 반환.
 * receipt.to == escrow address, receipt.from ∈ user wallets 검증.
 */

export interface ConfirmOptions {
  chainId: number;
  hash: string;
  expectEvent: string; // 'PoolCreated' | 'PoolTaken' | ...
  user: AppUser;
}

export async function confirmTx(opts: ConfirmOptions): Promise<{ status: 'PENDING' } | { status: 'CONFIRMED'; args: unknown }> {
  const { chainId, hash, expectEvent, user } = opts;
  const client = publicClientFor(chainId);
  const contract = escrowContract(chainId);

  const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null);
  if (!receipt) {
    return { status: 'PENDING' };
  }

  // 실패한 tx
  if (receipt.status === 'reverted') {
    throw new AuthError(400, 'Transaction reverted');
  }

  // 수신자가 EscrowVault 컨트랙트인지 확인
  if (!receipt.to || receipt.to.toLowerCase() !== contract.address.toLowerCase()) {
    throw new AuthError(400, 'Transaction not sent to EscrowVault');
  }

  // 발신자가 유저의 지갑 중 하나인지 확인
  const { data: wallets } = await db().from('user_wallets').select('address').eq('user_id', user.id);
  const userAddresses = (wallets ?? []).map((w: { address: string }) => w.address.toLowerCase());
  if (!userAddresses.includes(receipt.from.toLowerCase())) {
    throw new AuthError(403, 'Transaction not from user wallet');
  }

  // 기대한 이벤트 로그 찾기
  const { decodeEventLog } = await import('viem');
  const eventLog = receipt.logs.find((log: Log) => {
    try {
      const decoded = decodeEventLog({
        abi: contract.abi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      return decoded.eventName === expectEvent;
    } catch {
      return false;
    }
  });

  if (!eventLog) {
    throw new AuthError(400, `Expected event ${expectEvent} not found`);
  }

  // 이벤트 적용
  await applyEvent(chainId, eventLog as Log);

  // onchain_txs CONFIRMED 기록
  await db()
    .from('onchain_txs')
    .upsert(
      {
        chain_id: chainId,
        hash,
        status: 'CONFIRMED',
        block_number: Number(receipt.blockNumber),
        gas_used: receipt.gasUsed.toString(),
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'chain_id,hash' }
    );

  const decoded = decodeEventLog({
    abi: contract.abi,
    data: eventLog.data,
    topics: eventLog.topics as [`0x${string}`, ...`0x${string}`[]],
  });

  return { status: 'CONFIRMED', args: decoded.args };
}
