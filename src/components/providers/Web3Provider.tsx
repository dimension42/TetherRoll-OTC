'use client';

import { useState, useEffect } from 'react';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#00c9a7',
            accentColorForeground: '#000',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
          locale="en"
        >
          {mounted ? children : null}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
