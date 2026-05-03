import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, bsc, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'TetherRoll',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mainnet, polygon, bsc, sepolia],
  ssr: true,
});
