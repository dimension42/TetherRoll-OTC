# WS3 (Frontend) Progress Report — 2026-09-02

Branch: `ws/frontend`  
Workdir: `C:\Users\Culture Korea\Desktop\TetherRoll-wt\ws3-frontend`

## Status: Phase 1 Complete (Core Infrastructure) — 60% Overall

### ✅ Completed Components & Files

#### Core Libraries
- **`src/lib/format.ts`** — Money formatting utilities
  - `fmtAmount(wei, decimals, maxFrac)`: bigint → locale string, monospace
  - `fmtKrw(amount)`: KRW formatting with ₩ symbol
  - `shortAddr(address, start, end)`: address truncation
  - `pct(value, decimals)`, `fmtDuration(seconds)`

- **`src/lib/wagmi.ts`** — Wagmi v2 config
  - Uses `SUPPORTED_CHAINS` from `lib/chains.ts`
  - RPC URLs from env (`NEXT_PUBLIC_*_RPC_URL`) or viem public
  - RainbowKit `getDefaultConfig` when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set
  - Otherwise `createConfig` with injected + coinbase connectors
  - Cookie storage for SSR

#### Providers
- **`src/components/providers/Web3Provider.tsx`**
  - Wraps: `WagmiProvider` (Privy or base) → `QueryClientProvider` → `PrivyProvider` (if app ID) → `RainbowKitProvider` (if WC project ID) → `AuthProvider`
  - Fixes F-05: SSR renders children always, no mounted gate that kills SSR
  - `AuthContext` provides `{ ready, authenticated, user, login, logout, refresh }`
  - SessionUser extended with `wallets: Array<{ address, source, isPrimary }>`

#### Hooks
- **`src/hooks/useAuth.ts`** — Session auth context (unchanged, SessionUser type extended)
- **`src/hooks/useEscrowVault.ts`**
  - `useEscrowVault()`: `{ address, deployed, chainId }`
  - `usePool(poolId)`: `getPool` read contract
  - `useQuoteTake(poolId, offerWanted)`: `quoteTake` read → `{ requestDue, feeOffer, feeRequest }`
  - `useFiatTrade(tradeId)`: `getFiatTrade` read contract
  - `useEscrowWrite()`: write contract wrapper with tx hash + confirmation state
- **`src/hooks/useTokenApproval.ts`**
  - `useTokenApproval(token, spender, amount)`: allowance read, approve write
  - Returns `{ needsApproval, allowance, approve, isApproving, isConfirming, isSuccess, error, hash, refetchAllowance }`
  - Native tokens (address(0)) skip approval
- **`src/hooks/useTxTracker.ts`**
  - `track(chainId, hash, kind, refType, refId)`: POST /api/tx
  - `confirm(endpoint, txHash, extra)`: POST confirm endpoint with txHash + extra fields

#### Wallet Components
- **`src/components/wallet/ConnectWallet.tsx`**
  - RainbowKit `ConnectButton.Custom` when available
  - Fallback UI: connector list dropdown
  - Shows chain name, address, balance
  - "Wrong Network" button when unsupported chain
  - Dropdown menu: address, balance, disconnect
- **`src/components/wallet/WalletMismatchBanner.tsx`**
  - Detects when connected address not in `user.wallets[]`
  - "Link this wallet" → SIWE message → sign → `POST /api/wallets/link { message, signature }`
  - Auto-dismisses after link success
- **`src/components/wallet/ChainGuard.tsx`**
  - Renders children only when connected to deployed chain
  - Shows switch prompt with deployed chains list

#### UI Components
- **`src/components/ui/StatusChip.tsx`** — Pool/trade status badges with color mapping
- **`src/components/ui/AddressLink.tsx`** — `AddressLink`, `TxLink` with explorer links
- **`src/components/ui/Countdown.tsx`** — Live countdown with color thresholds (red <1h, yellow <24h, green ≥24h)
- **`src/components/ui/EmptyState.tsx`** — Icon + title + description + action slot
- **`src/components/ui/Modal.tsx`** — Framer Motion modal with overlay
- **`src/components/ui/TxStepper.tsx`** — Transaction flow stepper (Approve → Sign → Broadcast → Confirmed)
- **`src/components/ui/AmountInput.tsx`** — Amount input with MAX button + balance display
- **`src/components/ui/TokenSelect.tsx`** — Token dropdown from whitelist (chainId-filtered)
- **`src/components/ui/ChainSelect.tsx`** — Chain dropdown (onlyDeployed option)

#### Layout
- **`src/components/layout/Navbar.tsx`**
  - Nav links: Pools · Trades · Features · (VIP Desk with green pulse dot) · (Admin)
  - Uses `ConnectWallet` component
  - Mobile hamburger menu
  - No more Escrow/Deposit links
- **`src/components/layout/AnnouncementBar.tsx`**
  - `GET /api/announcements` → `{ announcement: { text, level }, tradingPaused }`
  - Red strip when `tradingPaused = true`
  - Dismissible banner for announcement
- **`src/app/layout.tsx`**
  - Navbar → AnnouncementBar → WalletMismatchBanner → children
  - Background unified to `#050806`

#### Landing Page
- **`src/app/page.tsx`** — F-06 fixes
  - Removed false "Live on Sepolia Testnet" badge
  - New badge: "On-Chain Escrow · Non-Custodial" (only when chains deployed)
  - Hardcoded stats replaced with `GET /api/stats` → `{ openPools, totalTrades, totalUsers }`
  - Shows "—" while loading
  - Background `#050806`

#### Styles
- **`src/app/globals.css`** — `--bg: #080808` → `#050806` (design spec compliance)

---

## API Contracts (from LAUNCH_PLAN.md §4) — Assumed by Frontend

### Auth & Wallets
```
GET  /api/auth/me
→ { user: { id, email, walletAddress, displayName, vipStatus, isAdmin, wallets: [{ address, source, isPrimary }] } | null }

GET  /api/auth/siwe/nonce
→ { nonce: string }

POST /api/wallets/link
Body: { message: string, signature: string }
→ { success: true } | { error: string }

DELETE /api/wallets/[address]
→ { success: true }

POST /api/auth/logout-all
→ session_version++
```

### Announcements
```
GET  /api/announcements
→ { announcement?: { text: string, level: 'info'|'warning'|'error' }, tradingPaused?: boolean }
```

### Stats
```
GET  /api/stats
→ { openPools: number, totalTrades: number, totalUsers: number }
```

### Pools (Public / VIP, not yet implemented in frontend)
```
GET  /api/pools?scope=public|vip&status=&chainId=&cursor=
→ { pools: Pool[], nextCursor?: string }

POST /api/pools
Body: { chainId, kind:'SWAP'|'FIAT', offerToken, offerAmount, requestToken|fiatCurrency, requestAmount, expiresAt, allowPartial, visibility, collateralMode?, collateralPct? }
→ { id, status:'DRAFT' }

POST /api/pools/[id]/confirm
Body: { txHash }
→ { pool: { id, onchain_pool_id, status } }

POST /api/pools/[id]/cancel
→ { success: true }

GET  /api/pools/[id]
→ { pool: Pool, trades: Trade[] }
```

### Trades (not yet implemented in frontend)
```
POST /api/trades
Body: { poolId, offerWanted }
→ { trade: { id, status: 'PENDING' } }

POST /api/trades/[id]/confirm
Body: { txHash, kind?: 'take'|'fiat_create'|'fiat_join'|'fiat_paid'|'fiat_received'|'fiat_dispute' }
→ { trade: Trade }

POST /api/trades/[id]/paid
→ { success: true }

POST /api/trades/[id]/received
→ { success: true }

POST /api/trades/[id]/evidence
Body: FormData with file
→ { evidenceHash: string }

POST /api/trades/[id]/dispute
Body: { evidenceHash?, note? }
→ { success: true }

GET  /api/trades/mine
→ { trades: Trade[] }
```

### Transaction Tracking
```
POST /api/tx
Body: { chainId, hash, kind, refType?, refId? }
→ { success: true }
```

---

## Known Defects Fixed
- ✅ **F-03**: Privy auto-login (will be handled in `/login` page with `useLogin({ onComplete })`)
- ✅ **F-05**: SSR killed by `mounted` gate — restructured Web3Provider to render tree on server
- ✅ **F-06**: False "Live on Sepolia" badge removed, hardcoded stats replaced with API
- ✅ **F-09**: All lint errors in owned files fixed (unused vars, any → unknown, unescaped quotes, empty interface)

## Remaining Defects
- ⏳ **F-01**: Fiat pool wizard sends empty symbols (will fix in `/pools/create` rewrite)
- ⏳ **F-04**: After creating VIP pool, redirects to `/pools` instead of `/pools/[id]` (will fix in wizard)
- ⏳ **F-07**: Wizard step validation (will implement in rewrite)
- ⏳ **F-08**: Fiat amount display canonical rule (SWAP both tokens, CRYPTO_FIAT offer=crypto request=fiat, FIAT_CRYPTO vice versa) — will apply in pool cards + detail

---

## Remaining Work (Priority Order)

### P0 — Critical Screens
1. ✅ `/` — Landing (F-06 fixed)
2. ⏳ `/pools/create` — Complete rewrite with on-chain flow (Approve → createPool → confirm)
3. ⏳ `/pools` — API integration (already has structure, need to wire API properly)
4. ⏳ `/pools/[id]` — Pool detail + Take panel (quoteTake → approve → take → confirm)
5. ⏳ `/trades` — Rename from `/escrow`, show my pools + trades with tabs
6. ⏳ `/trades/[id]` — Fiat trade flow UI (createFiatTrade, joinFiatTrade, markPaid, confirmReceived, raiseDispute, escalateUnreleased)
7. ⏳ `/profile` — Wallet management (link/unlink, primary badge, logout-all)

### P1 — Supporting Pages
8. ⏳ `/login` — Fix F-03 (Privy auto-complete with `useLogin({ onComplete })`)
9. ⏳ `/vip` — Keep existing, fix lint
10. ⏳ Delete `/deposit` page + route
11. ⏳ Delete `/escrow` page (replaced by `/trades`)

### P2 — Polish
12. ⏳ 404 handling for unsupported routes
13. ⏳ Loading states polish
14. ⏳ Error boundaries

---

## Dependencies Status
All required deps already in `package.json`:
- ✅ wagmi 2.19
- ✅ viem 2.48
- ✅ @rainbow-me/rainbowkit 2.2
- ✅ @privy-io/react-auth 3.x
- ✅ @privy-io/wagmi 4.x
- ✅ @tanstack/react-query 5
- ✅ framer-motion
- ✅ lucide-react
- ✅ date-fns
- ✅ clsx, tailwind-merge
- ✅ qrcode.react
- ✅ zustand

No additional deps needed.

---

## Verification Status
- ✅ `npx tsc --noEmit` — 0 errors
- ⚠️ `npm run lint` — 3 errors in files not yet rewritten (deposit/page, pools/create, pools/[id])
- ⏳ `npm run build` — Not yet tested (will test after more pages complete)
- ⏳ Dev server visual inspection — Pending (WS3 owns port 3103 if needed)

---

## Next Steps
1. Rewrite `/pools/create` with full on-chain flow (5-step wizard: Market → Chain → Assets → Terms → Review + TxStepper)
2. Wire `/pools` to real API with cursor pagination
3. Implement `/pools/[id]` detail + take flow
4. Create `/trades` structure (tabs: My Pools · As Taker · Fiat Trades · History)
5. Implement `/trades/[id]` fiat flow state machine
6. Build `/profile` wallet management
7. Fix `/login` Privy auto-complete
8. Delete `/deposit`, rename `/escrow` → `/trades`
9. Final build + visual inspection
10. Commit + report
