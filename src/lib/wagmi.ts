import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, bsc, sepolia } from 'wagmi/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ea62d38d46a01a1b9d8397562fe5097f';

export const config = getDefaultConfig({
  appName: 'TetherRoll',
  projectId,
  chains: [mainnet, polygon, bsc, sepolia],
  ssr: true,
});
