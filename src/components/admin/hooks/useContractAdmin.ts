import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { escrowVaultAbi } from '@/lib/contracts/abi';
import { txUrl } from '@/lib/chains';
import type { Address } from 'viem';

function escrowVaultAddress(chainId: number): Address {
  // From src/lib/contracts/addresses.ts pattern
  const map: Record<number, Address> = {
    11155111: '0x0000000000000000000000000000000000000000', // Sepolia (placeholder)
    137: '0x0000000000000000000000000000000000000000',
    56: '0x0000000000000000000000000000000000000000',
    1: '0x0000000000000000000000000000000000000000',
  };
  return map[chainId] || '0x0000000000000000000000000000000000000000';
}

export function useContractAdmin(chainId: number) {
  const { address: userAddress } = useAccount();
  const contractAddress = escrowVaultAddress(chainId);

  // Role checks
  const { data: isDefaultAdmin } = useReadContract({
    address: contractAddress,
    abi: escrowVaultAbi,
    functionName: 'hasRole',
    args: [
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, // DEFAULT_ADMIN_ROLE
      userAddress || '0x0000000000000000000000000000000000000000',
    ],
    chainId,
    query: { enabled: !!userAddress },
  });

  const { data: isPauser } = useReadContract({
    address: contractAddress,
    abi: escrowVaultAbi,
    functionName: 'hasRole',
    args: [
      '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a' as `0x${string}`, // PAUSER_ROLE
      userAddress || '0x0000000000000000000000000000000000000000',
    ],
    chainId,
    query: { enabled: !!userAddress },
  });

  const { data: isArbitrator } = useReadContract({
    address: contractAddress,
    abi: escrowVaultAbi,
    functionName: 'hasRole',
    args: [
      '0x3c6f16a2e3a9a69a6f8a9e1c7e1f5f3b6f6d4a0c5e1b2a3c4d5e6f7a8b9c0d1e2' as `0x${string}`, // ARBITRATOR_ROLE (placeholder - use actual)
      userAddress || '0x0000000000000000000000000000000000000000',
    ],
    chainId,
    query: { enabled: !!userAddress },
  });

  // Contract state reads
  const { data: feeBps } = useReadContract({
    address: contractAddress,
    abi: escrowVaultAbi,
    functionName: 'feeBps',
    chainId,
  });

  const { data: penaltyBps } = useReadContract({
    address: contractAddress,
    abi: escrowVaultAbi,
    functionName: 'penaltyBps',
    chainId,
  });

  const { data: feeRecipient } = useReadContract({
    address: contractAddress,
    abi: escrowVaultAbi,
    functionName: 'feeRecipient',
    chainId,
  });

  const { data: paused } = useReadContract({
    address: contractAddress,
    abi: escrowVaultAbi,
    functionName: 'paused',
    chainId,
  });

  // Write operations
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
  });

  const setFees = (newFeeBps: number, newPenaltyBps: number) => {
    writeContract({
      address: contractAddress,
      abi: escrowVaultAbi,
      functionName: 'setFees',
      args: [newFeeBps, newPenaltyBps],
      chainId,
    });
  };

  const setFeeRecipient = (newRecipient: Address) => {
    writeContract({
      address: contractAddress,
      abi: escrowVaultAbi,
      functionName: 'setFeeRecipient',
      args: [newRecipient],
      chainId,
    });
  };

  const pause = () => {
    writeContract({
      address: contractAddress,
      abi: escrowVaultAbi,
      functionName: 'pause',
      chainId,
    });
  };

  const unpause = () => {
    writeContract({
      address: contractAddress,
      abi: escrowVaultAbi,
      functionName: 'unpause',
      chainId,
    });
  };

  const resolveDispute = (tradeId: bigint, buyerWins: boolean) => {
    writeContract({
      address: contractAddress,
      abi: escrowVaultAbi,
      functionName: 'resolveDispute',
      args: [tradeId, buyerWins],
      chainId,
    });
  };

  const expire = (poolId: bigint) => {
    writeContract({
      address: contractAddress,
      abi: escrowVaultAbi,
      functionName: 'expire',
      args: [poolId],
      chainId,
    });
  };

  return {
    userAddress,
    contractAddress,
    isDefaultAdmin: !!isDefaultAdmin,
    isPauser: !!isPauser,
    isArbitrator: !!isArbitrator,
    feeBps: feeBps ? Number(feeBps) : undefined,
    penaltyBps: penaltyBps ? Number(penaltyBps) : undefined,
    feeRecipient,
    paused: !!paused,
    setFees,
    setFeeRecipient,
    pause,
    unpause,
    resolveDispute,
    expire,
    txHash,
    isPending,
    isConfirming,
    isConfirmed,
    writeError,
    explorerUrl: txHash ? txUrl(chainId, txHash) : undefined,
  };
}
