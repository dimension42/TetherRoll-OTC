import { type Log } from 'viem';
import { db } from '@/lib/db';
import { publicClientFor, escrowContract } from '@/lib/onchain/client';
import { applyEvent } from '@/lib/onchain/events';
import { ESCROW_VAULT } from '@/lib/contracts/addresses';

/**
 * 블록체인 이벤트 인덱서 — 체인별 cursor부터 최신 블록까지 로그 가져와 DB 반영.
 * Vercel cron (1분) 호출. 재개 가능, RPC 에러 허용.
 */

const MAX_BLOCK_RANGE = 2000; // getLogs 한 번에 최대 블록 수

export interface IndexerResult {
  chain: number;
  from: number;
  to: number;
  events: number;
  error?: string;
}

export async function runIndexer(): Promise<IndexerResult[]> {
  const results: IndexerResult[] = [];

  for (const [chainIdStr, deployment] of Object.entries(ESCROW_VAULT)) {
    const chainId = Number(chainIdStr);
    if (deployment.address === '0x0000000000000000000000000000000000000000') continue; // 미배포

    try {
      const result = await indexChain(chainId, deployment.deployedBlock);
      results.push(result);
    } catch (e) {
      console.error(`Indexer error on chain ${chainId}:`, e);
      results.push({ chain: chainId, from: 0, to: 0, events: 0, error: String(e) });
    }
  }

  return results;
}

async function indexChain(chainId: number, deployedBlock: number): Promise<IndexerResult> {
  const client = publicClientFor(chainId);
  const contract = escrowContract(chainId);

  // 커서 조회 (없으면 deployedBlock부터)
  const { data: cursor } = await db()
    .from('indexer_cursors')
    .select('last_block')
    .eq('chain_id', chainId)
    .eq('contract', 'EscrowVault')
    .maybeSingle();

  const fromBlock = cursor?.last_block ? BigInt(cursor.last_block) + BigInt(1) : BigInt(deployedBlock);

  // 최신 블록 (latest - 1, 재org 방지)
  const latestBlock = await client.getBlockNumber();
  const toBlock = latestBlock > BigInt(0) ? latestBlock - BigInt(1) : latestBlock;

  if (fromBlock > toBlock) {
    // 아직 인덱싱할 블록 없음
    return { chain: chainId, from: Number(fromBlock), to: Number(toBlock), events: 0 };
  }

  // 청크 단위로 getLogs (2000 블록씩)
  let currentFrom = fromBlock;
  let totalEvents = 0;

  while (currentFrom <= toBlock) {
    const rangeSize = BigInt(MAX_BLOCK_RANGE);
    const currentTo = currentFrom + rangeSize - BigInt(1) > toBlock ? toBlock : currentFrom + rangeSize - BigInt(1);

    const logs = await client.getLogs({
      address: contract.address,
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    // 각 로그를 applyEvent로 처리
    for (const log of logs) {
      await applyEvent(chainId, log as Log);
      totalEvents++;
    }

    // 커서 갱신
    await db()
      .from('indexer_cursors')
      .upsert(
        {
          chain_id: chainId,
          contract: 'EscrowVault',
          last_block: Number(currentTo),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'chain_id,contract' }
      );

    currentFrom = currentTo + BigInt(1);
  }

  return { chain: chainId, from: Number(fromBlock), to: Number(toBlock), events: totalEvents };
}
