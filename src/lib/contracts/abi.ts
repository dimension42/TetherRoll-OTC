import { parseAbi } from 'viem';

/**
 * EscrowVault v2 ABI — docs/CONTRACT_V2_SPEC.md 와 1:1.
 * WS1이 컴파일 산출물에서 `export-abi.js`로 재생성한다. 시그니처가 바뀌면 반드시 여기도 갱신.
 */
export const escrowVaultAbi = parseAbi([
  // ── constants / params ──
  'function MAX_FEE_BPS() view returns (uint16)',
  'function MAX_PENALTY_BPS() view returns (uint16)',
  'function MAX_POOL_DURATION() view returns (uint64)',
  'function MAX_TRADE_DURATION() view returns (uint64)',
  'function MAX_RELEASE_WINDOW() view returns (uint64)',
  'function ARBITRATOR_ROLE() view returns (bytes32)',
  'function PAUSER_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function feeBps() view returns (uint16)',
  'function penaltyBps() view returns (uint16)',
  'function feeRecipient() view returns (address)',
  'function paused() view returns (bool)',
  'function nextPoolId() view returns (uint256)',
  'function nextTradeId() view returns (uint256)',
  'function hasRole(bytes32 role, address account) view returns (bool)',

  // ── admin ──
  'function setFees(uint16 feeBps_, uint16 penaltyBps_)',
  'function setFeeRecipient(address feeRecipient_)',
  'function pause()',
  'function unpause()',
  'function grantRole(bytes32 role, address account)',
  'function revokeRole(bytes32 role, address account)',

  // ── swap pools ──
  'function createPool(address offerToken, uint256 offerAmount, address requestToken, uint256 requestAmount, uint64 expiresAt, bool allowPartial) payable returns (uint256 poolId)',
  'function take(uint256 poolId, uint256 offerWanted) payable',
  'function cancel(uint256 poolId)',
  'function expire(uint256 poolId)',
  'function quoteTake(uint256 poolId, uint256 offerWanted) view returns (uint256 requestDue, uint256 feeOffer, uint256 feeRequestEstimate)',
  'function getPool(uint256 poolId) view returns ((address maker, address offerToken, address requestToken, uint256 offerAmount, uint256 offerRemaining, uint256 requestAmount, uint64 expiresAt, bool allowPartial, uint16 feeBps, uint8 status))',

  // ── fiat trades ──
  'function createFiatTrade(address buyer, address token, uint256 amount, address bondToken, uint256 bondAmount, uint64 deadline, uint64 releaseWindow) payable returns (uint256 tradeId)',
  'function joinFiatTrade(uint256 tradeId) payable',
  'function markPaid(uint256 tradeId)',
  'function confirmReceived(uint256 tradeId)',
  'function cancelFiatTrade(uint256 tradeId)',
  'function expireFiatTrade(uint256 tradeId)',
  'function raiseDispute(uint256 tradeId, bytes32 evidenceHash)',
  'function escalateUnreleased(uint256 tradeId)',
  'function resolveDispute(uint256 tradeId, bool buyerWins)',
  'function cancelApprovals(uint256 tradeId, address party) view returns (bool)',
  'function getFiatTrade(uint256 tradeId) view returns ((address seller, address buyer, address token, uint256 amount, address bondToken, uint256 bondAmount, uint64 deadline, uint64 releaseWindow, uint64 paidAt, uint16 feeBps, uint8 status, bytes32 evidenceHash))',

  // ── events ──
  'event PoolCreated(uint256 indexed poolId, address indexed maker, address offerToken, uint256 offerAmount, address requestToken, uint256 requestAmount, uint64 expiresAt, bool allowPartial, uint16 feeBps)',
  'event PoolTaken(uint256 indexed poolId, address indexed taker, uint256 offerOut, uint256 requestIn, uint256 feeOffer, uint256 feeRequest, uint256 offerRemaining)',
  'event PoolCancelled(uint256 indexed poolId, uint256 refunded)',
  'event PoolExpired(uint256 indexed poolId, uint256 refunded)',
  'event FiatTradeCreated(uint256 indexed tradeId, address indexed seller, address indexed buyer, address token, uint256 amount, address bondToken, uint256 bondAmount, uint64 deadline, uint64 releaseWindow, uint16 feeBps)',
  'event FiatTradeJoined(uint256 indexed tradeId, uint256 bondReceived)',
  'event FiatTradePaid(uint256 indexed tradeId)',
  'event FiatTradeReleased(uint256 indexed tradeId, uint256 fee)',
  'event FiatTradeCancelled(uint256 indexed tradeId)',
  'event FiatTradeExpired(uint256 indexed tradeId)',
  'event FiatTradeDisputed(uint256 indexed tradeId, address indexed raisedBy, bytes32 evidenceHash)',
  'event FiatTradeResolved(uint256 indexed tradeId, bool buyerWins, uint256 amountToWinner, uint256 penalty)',
  'event FeesUpdated(uint16 feeBps, uint16 penaltyBps)',
  'event FeeRecipientUpdated(address feeRecipient)',
]);

export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);

/** 컨트랙트 enum ↔ DB status 매핑 */
export const POOL_STATUS_ONCHAIN = ['OPEN', 'FILLED', 'CANCELLED', 'EXPIRED'] as const;
export const TRADE_STATUS_ONCHAIN = [
  'AWAITING_BOND', 'ACTIVE', 'PAID', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'RESOLVED',
] as const;
