// Contract addresses - update after deployment
export const CONTRACTS = {
  11155111: { // Sepolia
    poolRegistry: '0x0000000000000000000000000000000000000000',
    escrowVault: '0x0000000000000000000000000000000000000000',
    feeDistributor: '0x0000000000000000000000000000000000000000',
  },
  137: { // Polygon
    poolRegistry: '0x0000000000000000000000000000000000000000',
    escrowVault: '0x0000000000000000000000000000000000000000',
    feeDistributor: '0x0000000000000000000000000000000000000000',
  },
} as const;

export const SUPPORTED_TOKENS: Record<number, { symbol: string; address: string; decimals: number; icon: string }[]> = {
  11155111: [
    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, icon: '⟠' },
    { symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6, icon: '💵' },
    { symbol: 'USDT', address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', decimals: 6, icon: '💵' },
  ],
  137: [
    { symbol: 'MATIC', address: '0x0000000000000000000000000000000000000000', decimals: 18, icon: '⬡' },
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, icon: '💵' },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, icon: '💵' },
    { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, icon: '₿' },
  ],
};

export const FIAT_CURRENCIES = [
  { code: 'KRW', name: 'Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
];

export const POOL_STATUS = {
  0: { label: 'OPEN', class: 'badge-open' },
  1: { label: 'PARTIAL', class: 'badge-partial' },
  2: { label: 'MATCHED', class: 'badge-matched' },
  3: { label: 'CANCELLED', class: 'badge-cancelled' },
  4: { label: 'COMPLETED', class: 'badge-completed' },
} as const;

export const ESCROW_STATUS = {
  0: { label: 'PENDING', class: 'badge-matched' },
  1: { label: 'ACTIVE', class: 'badge-open' },
  2: { label: 'COMPLETED', class: 'badge-completed' },
  3: { label: 'DISPUTED', class: 'badge-disputed' },
  4: { label: 'CANCELLED', class: 'badge-cancelled' },
} as const;

// Admin wallet addresses (multisig members)
export const ADMIN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000', // replace with real admin addresses
];

export const PLATFORM_FEE_BPS = 30; // 0.3%
export const RELAY_FEE_BPS = 50;    // 0.5%
export const DEPOSIT_FEE_BPS = 10;  // 0.1%
