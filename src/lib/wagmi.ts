import { http, cookieStorage, createConfig, createStorage } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { injected, coinbaseWallet } from 'wagmi/connectors';
import { SUPPORTED_CHAINS } from '@/lib/chains';

const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// 환경변수에서 RPC URL 가져오기 (미설정 시 viem 기본 퍼블릭 RPC 사용)
const transports = Object.fromEntries(
  SUPPORTED_CHAINS.map(chain => {
    const rpcUrl =
      chain.id === 11155111 ? process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL :
      chain.id === 137 ? process.env.NEXT_PUBLIC_POLYGON_RPC_URL :
      chain.id === 56 ? process.env.NEXT_PUBLIC_BSC_RPC_URL :
      chain.id === 1 ? process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL :
      undefined;

    return [chain.id, rpcUrl ? http(rpcUrl) : http()];
  })
);

// RainbowKit 사용 가능하면 사용, 아니면 createConfig
export const config = wcProjectId
  ? getDefaultConfig({
      appName: 'TetherRoll',
      projectId: wcProjectId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chains: SUPPORTED_CHAINS as any,
      ssr: true,
      storage: createStorage({
        storage: cookieStorage,
      }),
    })
  : createConfig({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chains: SUPPORTED_CHAINS as any,
      connectors: [
        injected(),
        coinbaseWallet({ appName: 'TetherRoll' }),
      ],
      transports,
      ssr: true,
      storage: createStorage({
        storage: cookieStorage,
      }),
    });
