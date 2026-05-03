import { createConfig, http } from 'wagmi';
import { mainnet, polygon, bsc, sepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [mainnet, polygon, bsc, sepolia],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
