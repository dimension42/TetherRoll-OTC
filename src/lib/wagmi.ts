import { createConfig, http } from 'wagmi';
import { mainnet, polygon, bsc, sepolia } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const config = createConfig({
  chains: [mainnet, polygon, bsc, sepolia],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'TetherRoll' }),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
