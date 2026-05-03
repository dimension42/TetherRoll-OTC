export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'PRIVY_APP_ID_HERE';

export const DEPOSIT_TOKENS = [
  {
    symbol: 'USDT',
    name: 'Tether USD',
    icon: '₮',
    color: '#26A17B',
    chains: [
      { chainId: 1, name: 'Ethereum', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { chainId: 137, name: 'Polygon', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      { chainId: 56, name: 'BNB Chain', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    ],
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '$',
    color: '#2775CA',
    chains: [
      { chainId: 1, name: 'Ethereum', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      { chainId: 137, name: 'Polygon', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
      { chainId: 56, name: 'BNB Chain', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    ],
  },
] as const;
