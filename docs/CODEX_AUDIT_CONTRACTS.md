# EscrowVault v2 — Audit Checklist

**Version**: 2.0  
**Auditor**: [Name]  
**Date**: [YYYY-MM-DD]

## Scope

- `contracts/src/EscrowVault.sol` (single contract, ~700 LOC)
- OpenZeppelin v5: `AccessControl`, `Pausable`, `ReentrancyGuard`, `SafeERC20`
- No upgrades, no external calls beyond ERC-20 transfers

## Critical Invariants

### CODEX-C1: No Double Payment

**Claim**: Funds can only be disbursed once per pool/trade.

**Evidence**:
- Pool: `offerRemaining` is decremented in `take()` before any transfers. Cancel/expire check `status == OPEN`.
- Trade: `amount` and `bondAmount` are zeroed **before** `_push()` in `confirmReceived`, `resolveDispute`, `cancelFiatTrade`, `expireFiatTrade`.
- No balance ledgers; funds are locked in struct fields only.

**Test Coverage**:
- `Should take full pool` — checks balances match expected
- `Should complete full flow: markPaid -> confirmReceived` — verifies amounts zeroed after release
- `Should resolve dispute with buyer win` — checks no double disbursement

**Verdict**: [ ] PASS / [ ] FAIL / [ ] CONCERN

---

### CODEX-C2: Contract Balance == Sum of Locked Amounts

**Claim**: At all times, `balance(vault) >= sum(pool.offerRemaining) + sum(trade.amount) + sum(trade.bondAmount)`.

**Evidence**:
- `_pull()` records actual received amount (handles fee-on-transfer).
- `_push()` only sends what was recorded.
- No receive() function (direct ETH transfers revert, except via payable functions).

**Test Coverage**:
- `Should handle fee-on-transfer token` — verifies `offerAmount = received`
- All balance assertions in tests verify invariant holds

**Auditor Action**: Run property-based test with random sequences of create/take/cancel.

**Verdict**: [ ] PASS / [ ] FAIL / [ ] CONCERN

---

### CODEX-C3: Fee Caps Enforced

**Claim**: `feeBps <= 100` (1%), `penaltyBps <= 5000` (50%) at all times.

**Evidence**:
- Constructor and `setFees()` enforce `MAX_FEE_BPS` and `MAX_PENALTY_BPS`.
- Fees are snapshot at creation (`pool.feeBps`, `trade.feeBps`), so admin cannot retroactively increase.

**Test Coverage**:
- `Should revert on invalid constructor params`
- `Should reject fees above max`

**Verdict**: [ ] PASS / [ ] FAIL / [ ] CONCERN

---

### CODEX-C4: Pause Semantics

**Claim**: When paused, new pools/trades cannot be created, but users can withdraw existing funds.

**Evidence**:
- `createPool`, `take`, `createFiatTrade`, `joinFiatTrade` are `whenNotPaused`.
- `cancel`, `expire`, `confirmReceived`, `cancelFiatTrade`, `expireFiatTrade` are **not** `whenNotPaused`.

**Test Coverage**:
- `Should block creation when paused`
- `Should allow cancel/expire when paused`

**Verdict**: [ ] PASS / [ ] FAIL / [ ] CONCERN

---

### CODEX-C5: Native ETH Push Failure DoS

**Concern**: If recipient is a contract that rejects ETH, `_push()` reverts, causing DoS.

**Mitigation Status**: **No pull pattern**. If a taker/buyer is a contract that cannot receive ETH, the transaction fails. This is acceptable for v2 (simplicity > edge cases). Document in user guide: "Do not use non-payable contracts as taker/buyer."

**Alternative (CODEX-C5a)**: Implement pull pattern for ETH (recipients claim via separate call). **Decision**: Deferred to v3 if needed.

**Test Coverage**:
- `Should take pool with native offer` — tests contract can receive
- Manual test: RejectEth contract as taker should fail (expected behavior)

**Verdict**: [ ] ACCEPTED (documented) / [ ] REQUIRES FIX

---

### CODEX-C6: Fee-on-Transfer Token Handling

**Claim**: Actual received amount is used, not the requested amount.

**Evidence**:
- `_pull()` measures `balanceOf` before/after and returns `received`.
- `offerAmount = received` in `createPool`; `bondAmount = bondReceived` in `joinFiatTrade`.

**Test Coverage**:
- `Should handle fee-on-transfer token` — FeeOnTransferMock burns 1%, verifies `offerAmount = 99`

**Verdict**: [ ] PASS / [ ] FAIL / [ ] CONCERN

---

### CODEX-C7: Non-Standard ERC-20 (USDT, etc.)

**Concern**: USDT on mainnet does not return bool from `transfer()`.

**Mitigation**: OpenZeppelin `SafeERC20` handles this (checks success via assembly).

**Test Coverage**: Not tested (requires forking mainnet). Auditor should verify `SafeERC20` v5 implementation.

**Verdict**: [ ] PASS (OZ review) / [ ] REQUIRES FORK TEST

---

### CODEX-C8: Deadline Manipulation

**Concern**: Maker sets `expiresAt` far in future, locking liquidity.

**Mitigation**: `MAX_POOL_DURATION = 30 days`, `MAX_TRADE_DURATION = 7 days` enforced in creation.

**Test Coverage**:
- `Should revert on invalid pool params` — checks deadline limits

**Verdict**: [ ] PASS / [ ] FAIL / [ ] CONCERN

---

### CODEX-C9: Arbitrator Centralization

**Concern**: `ARBITRATOR_ROLE` can unilaterally decide dispute outcomes.

**Mitigation**: 
- Intended design (VIP Desk requires human arbitration).
- Admin can grant role to a multisig (e.g. 2-of-3).
- Disputes emit `FiatTradeDisputed` with `evidenceHash` (transparency).

**Recommendation**: Use Gnosis Safe 2-of-3 for `ARBITRATOR_ROLE` in production.

**Verdict**: [ ] ACCEPTED (operational control) / [ ] CONCERN

---

### CODEX-C10: Front-Running of `take()`

**Concern**: On partial pools, a taker's transaction can be front-run by another taker.

**Mitigation**: **Not mitigated** (intended MEV exposure). Users can:
- Create non-partial pools (all-or-nothing).
- Use private RPC (Flashbots, etc.).

**Verdict**: [ ] ACCEPTED (expected behavior)

---

### CODEX-C11: Reentrancy

**Claim**: All fund-moving functions are protected.

**Evidence**:
- All `external payable` or fund-transfer functions are `nonReentrant`.
- CEI pattern: state changes before `_push()`.

**Test Coverage**:
- `Should block reentrant take` — ReentrantTaker contract attempts re-entry on ETH receive

**Auditor Action**: Run Slither/Mythril for reentrancy patterns.

**Verdict**: [ ] PASS / [ ] FAIL

---

### CODEX-C12: Rounding in `ceilDiv`

**Claim**: `_ceilDiv` rounds up to favor protocol (taker pays slightly more).

**Evidence**:
```solidity
function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
    return a == 0 ? 0 : (a - 1) / b + 1;
}
```

**Auditor Action**: Verify no underflow for edge cases (a=1, b=large).

**Test Coverage**: Implicit in `Should take partial pool twice` (checks requestDue calculations)

**Verdict**: [ ] PASS / [ ] FAIL

---

## Gas Optimization Review

| Function | Estimated Gas | Notes |
|----------|--------------|-------|
| `createPool` (ERC20) | ~120k | ERC20 transfer + storage |
| `take` (full) | ~150k | 2x ERC20 transfers + fee |
| `createFiatTrade` | ~100k | ERC20 transfer |
| `confirmReceived` | ~80k | 2x ERC20 transfers |

**Recommendation**: Use `viaIR: true` (already enabled).

---

## External Dependencies

- OpenZeppelin v5.0.2: `SafeERC20`, `AccessControl`, `Pausable`, `ReentrancyGuard`
- Auditor should review OZ contracts (well-audited, no known issues as of 2024).

---

## Deployment Checklist

- [ ] Deploy with multisig as `admin`
- [ ] Set `feeRecipient` to treasury multisig
- [ ] Grant `ARBITRATOR_ROLE` to ops multisig (2-of-3)
- [ ] Grant `PAUSER_ROLE` to ops wallet
- [ ] Verify on Etherscan
- [ ] Test 1 pool + 1 trade on testnet before mainnet
- [ ] Monitor first 48h for anomalies

---

## Test Coverage Summary

**Total Tests**: 44  
**Coverage**: ~95% (excludes error branches)

| Category | Tests | Notes |
|----------|-------|-------|
| Deployment | 2 | Constructor params |
| Admin | 4 | Fee limits, recipient update |
| Swap Pools | 13 | Create, take, cancel, expire |
| Fiat Trades | 16 | Bond, paid, release, cancel, expire |
| Disputes | 5 | Raise, resolve, escalate |
| Pause | 2 | Block creation, allow withdrawal |
| Reentrancy | 1 | ReentrantTaker mock |
| Gas | 4 | Report key functions |

**Uncovered Scenarios** (require manual testing):
- [ ] Real USDT (non-standard transfer)
- [ ] Gas exhaustion on large loop (N/A — no loops)
- [ ] RejectEth contract as recipient (expected to fail)

---

## Auditor Sign-Off

**Auditor**: ____________________  
**Date**: ____________________  
**Verdict**: [ ] APPROVED / [ ] CONDITIONAL / [ ] REJECTED

**Conditions** (if any):
1.
2.

**Recommendations**:
1. Deploy `ARBITRATOR_ROLE` to Gnosis Safe 2-of-3
2. Add pull pattern for ETH in v3 (low priority)
3. Fork-test USDT transfers on mainnet before production

---

## Changelog

- **2024-XX-XX**: Initial checklist (v2.0)
