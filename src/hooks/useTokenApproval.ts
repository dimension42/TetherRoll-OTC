import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import { erc20Abi } from '@/lib/contracts/abi';
import { isNative } from '@/lib/tokens';

/**
 * ERC-20 approve 관리
 * Native 토큰(address(0))은 approve 불필요 → needsApproval = false
 */
export function useTokenApproval(
  token: Address | null | undefined,
  spender: Address | null | undefined,
  amount: bigint | null | undefined
) {
  const { address: userAddress } = useAccount();

  // Native 토큰은 approve 불필요
  const isNativeToken = token ? isNative(token) : false;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token && !isNativeToken ? token : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && spender ? [userAddress, spender] : undefined,
    query: {
      enabled: !!token && !isNativeToken && !!userAddress && !!spender,
    },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const needsApproval = !isNativeToken && amount !== null && amount !== undefined && amount > BigInt(0) && (allowance ?? BigInt(0)) < amount;

  const approve = () => {
    if (!token || !spender || !amount || isNativeToken) return;
    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  return {
    needsApproval,
    allowance: allowance ?? BigInt(0),
    approve,
    isApproving: isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
    refetchAllowance,
  };
}
