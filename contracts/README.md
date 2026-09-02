# EscrowVault v2 — Smart Contracts

Solidity 0.8.24 | Hardhat | OpenZeppelin v5

## Overview

EscrowVault v2 is a non-upgradeable P2P OTC trading contract supporting:
- **Swap Pools**: Atomic crypto↔crypto swaps with partial fills
- **Fiat Trades**: Crypto↔KRW trades with collateral and dispute resolution

Spec: `docs/CONTRACT_V2_SPEC.md`

## Installation

```bash
cd contracts
npm install
```

## Development

```bash
# Compile
npm run build

# Test
npm test

# Test with gas report
REPORT_GAS=true npm test
```

## Deployment

### Prerequisites

Create `../.env.local` (parent directory) with:

```bash
# Deployer
DEPLOYER_PRIVATE_KEY=0x...

# RPC endpoints
SEPOLIA_RPC_URL=https://...
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
ETHEREUM_RPC_URL=https://eth.llamarpc.com

# Etherscan API keys (for verification)
ETHERSCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
BSCSCAN_API_KEY=...

# Optional overrides
ADMIN_ADDRESS=0x...        # defaults to deployer
FEE_RECIPIENT=0x...        # defaults to deployer
```

### Deploy to Sepolia

1. Get testnet ETH from [Sepolia Faucet](https://sepoliafaucet.com)
2. Deploy:

```bash
npm run deploy:sepolia
```

3. Grant roles (from deployer account or admin):

```bash
# In Hardhat console or via script
const vault = await ethers.getContractAt("EscrowVault", "<address>");

const ARBITRATOR_ROLE = await vault.ARBITRATOR_ROLE();
const PAUSER_ROLE = await vault.PAUSER_ROLE();

await vault.grantRole(ARBITRATOR_ROLE, "<ops-wallet-address>");
await vault.grantRole(PAUSER_ROLE, "<ops-wallet-address>");
```

4. Verify on Etherscan:

```bash
npx hardhat verify --network sepolia <address> "<admin>" "<feeRecipient>" 30 1000
```

### Deploy to Mainnet

Same steps as Sepolia. For production:
- Use a hardware wallet or multisig for `ADMIN_ADDRESS`
- Set `FEE_RECIPIENT` to treasury multisig
- Test thoroughly on Sepolia first

```bash
npm run deploy:polygon   # Polygon PoS
npm run deploy:bsc       # BNB Chain
npm run deploy:mainnet   # Ethereum (not yet)
```

## Post-Deployment

### Export ABI

After deploying, export the ABI to the frontend:

```bash
npm run export-abi
```

This updates `src/lib/contracts/abi.ts`.

### Verify Types

From the **worktree root** (not contracts/):

```bash
npx tsc --noEmit
```

Should pass without errors.

## Admin Operations

### Pause Trading

```javascript
const vault = await ethers.getContractAt("EscrowVault", "<address>");
await vault.connect(pauser).pause();
```

**Effect**: `createPool`, `take`, `createFiatTrade`, `joinFiatTrade` revert. Users can still `cancel`, `expire`, `confirmReceived`, etc.

### Unpause

```javascript
await vault.connect(pauser).unpause();
```

### Update Fees

```javascript
await vault.connect(admin).setFees(50, 2000); // 0.5% fee, 20% penalty
```

**Limits**: `feeBps <= 100` (1%), `penaltyBps <= 5000` (50%)

### Change Fee Recipient

```javascript
await vault.connect(admin).setFeeRecipient("<new-address>");
```

## Testing

42 test cases covering:
- Pool creation (ERC20, native, fee-on-transfer)
- Partial & full takes
- Cancel / expire flows
- Fiat trade lifecycle (bond, paid, released)
- Mutual cancel
- Disputes & arbitration
- Pause / unpause
- Reentrancy protection

Run with gas report:

```bash
REPORT_GAS=true npm test
```

## Contract Addresses

See `deployments/<chainId>.json` for full records.

Live addresses in `src/lib/contracts/addresses.ts`:

- **Sepolia**: (deploy after merge)
- **Polygon**: TBD
- **BSC**: TBD
- **Ethereum**: TBD

## Security

- ✅ ReentrancyGuard on all fund-moving functions
- ✅ CEI pattern (state before transfers)
- ✅ Fee-on-transfer token support (balance-diff)
- ✅ No upgrades (immutable logic)
- ✅ Pausable (new pools/trades only)
- ✅ Role-based access (admin, arbitrator, pauser)

**Audit**: See `docs/CODEX_AUDIT_CONTRACTS.md` for checklist.

## License

MIT
