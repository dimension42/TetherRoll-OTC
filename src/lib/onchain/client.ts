import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet, polygon, bsc, sepolia } from 'viem/chains';
import { AuthError } from '@/lib/auth/guards';
import { rpcUrl } from '@/lib/chains';
import { escrowVaultAddress } from '@/lib/contracts/addresses';
import { escrowVaultAbi } from '@/lib/contracts/abi';

/**
 * 체인별 viem public client (캐시).
 */
const clients = new Map<number, PublicClient>();

export function publicClientFor(chainId: number): PublicClient {
  if (clients.has(chainId)) return clients.get(chainId)!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chainMap: Record<number, any> = {
    1: mainnet,
    137: polygon,
    56: bsc,
    11155111: sepolia,
  };
  const chain = chainMap[chainId];
  if (!chain) throw new AuthError(400, 'Unsupported chainId');

  const url = rpcUrl(chainId);
  const client = createPublicClient({
    chain,
    transport: http(url),
  }) as PublicClient;
  clients.set(chainId, client);
  return client;
}

/** EscrowVault 컨트랙트 주소 + ABI (배포 안 된 체인은 예외) */
export function escrowContract(chainId: number): { address: `0x${string}`; abi: typeof escrowVaultAbi } {
  const addr = escrowVaultAddress(chainId);
  if (!addr) throw new AuthError(400, 'Chain not deployed');
  return { address: addr, abi: escrowVaultAbi };
}
