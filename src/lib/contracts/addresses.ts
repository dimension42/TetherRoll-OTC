import type { Address } from 'viem';

/**
 * 체인별 EscrowVault v2 배포 주소.
 * `contracts/scripts/deploy.js`가 갱신한다. 0 주소 = 미배포 (프론트는 해당 체인을 비활성 표시).
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export const ESCROW_VAULT: Record<number, { address: Address; deployedBlock: number }> = {
  11155111: { address: ZERO_ADDRESS, deployedBlock: 0 }, // Sepolia
  137: { address: ZERO_ADDRESS, deployedBlock: 0 },      // Polygon
  56: { address: ZERO_ADDRESS, deployedBlock: 0 },       // BSC
  1: { address: ZERO_ADDRESS, deployedBlock: 0 },        // Ethereum
};

export function escrowVaultAddress(chainId: number): Address | null {
  const entry = ESCROW_VAULT[chainId];
  if (!entry || entry.address === ZERO_ADDRESS) return null;
  return entry.address;
}

export function isChainDeployed(chainId: number): boolean {
  return escrowVaultAddress(chainId) !== null;
}
