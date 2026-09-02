import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { escrowVaultAddress, isChainDeployed } from '@/lib/contracts/addresses';

export function useEscrowVault() {
  const { chain } = useAccount();
  const chainId = chain?.id;

  const address = chainId ? escrowVaultAddress(chainId) : null;
  const deployed = chainId ? isChainDeployed(chainId) : false;

  return {
    address,
    deployed,
    chainId,
  };
}

/**
 * 풀 온체인 조회
 */
export function usePool(poolId: number | null) {
  const { address } = useEscrowVault();

  const { data, isLoading, error, refetch } = useReadContract({
    address: address || undefined,
    abi: escrowVaultAbi,
    functionName: 'getPool',
    args: poolId !== null ? [BigInt(poolId)] : undefined,
    query: {
      enabled: !!address && poolId !== null,
    },
  });

  return {
    pool: data,
    isLoading,
    error,
    refetch,
  };
}

/**
 * quoteTake 조회 (take 전 예상 비용)
 */
export function useQuoteTake(poolId: number | null, offerWanted: bigint | null) {
  const { address } = useEscrowVault();

  const { data, isLoading } = useReadContract({
    address: address || undefined,
    abi: escrowVaultAbi,
    functionName: 'quoteTake',
    args: poolId !== null && offerWanted !== null ? [BigInt(poolId), offerWanted] : undefined,
    query: {
      enabled: !!address && poolId !== null && offerWanted !== null && offerWanted > BigInt(0),
    },
  });

  return {
    quote: data ? {
      requestDue: data[0],
      feeOffer: data[1],
      feeRequest: data[2],
    } : null,
    isLoading,
  };
}

/**
 * Fiat 트레이드 온체인 조회
 */
export function useFiatTrade(tradeId: number | null) {
  const { address } = useEscrowVault();

  const { data, isLoading, error, refetch } = useReadContract({
    address: address || undefined,
    abi: escrowVaultAbi,
    functionName: 'getFiatTrade',
    args: tradeId !== null ? [BigInt(tradeId)] : undefined,
    query: {
      enabled: !!address && tradeId !== null,
    },
  });

  return {
    trade: data,
    isLoading,
    error,
    refetch,
  };
}

/**
 * 쓰기 트랜잭션 헬퍼
 */
export function useEscrowWrite() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    write: writeContract,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
