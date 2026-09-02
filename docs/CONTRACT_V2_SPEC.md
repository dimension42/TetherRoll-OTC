# EscrowVault v2 — 컨트랙트 명세

> 구현 파일: `contracts/src/EscrowVault.sol` (v1 완전 대체). Solidity 0.8.24, OpenZeppelin v5.
> v1의 `PoolRegistry.sol`·`FeeDistributor.sol`은 삭제한다. 수수료 수취 주소는 EOA/멀티시그 하나(`feeRecipient`).
> 계승 결정: D2(몰수 담보는 정직한 상대방 보상), D4(온체인 스왑은 원자적 정산), D12(만료 시 예치자 환불, 누구나 트리거).

## 1. 설계 원칙

1. **당사자별 원장 없음 → 잔액은 구조체 필드로만 추적.** `Pool.offerRemaining`, `FiatTrade.amount`, `FiatTrade.bondAmount`. 전송 직후 해당 필드를 0/차감. 이중 지급 원천 차단.
2. **원자 스왑.** `take()` 한 트랜잭션에서 taker의 request 자산 pull → maker·taker·feeRecipient에 push. 대기 상태 없음.
3. **네이티브 코인은 `address(0)`.** ERC-20은 balance-diff로 실수령량을 기록(수수료 토큰 대응). msg.value는 네이티브일 때만 허용, 정확히 일치해야 함.
4. **불변 컨트랙트.** 업그레이드 프록시 없음. 파라미터(수수료·수취주소·중재자)만 어드민 변경 가능, 상한 고정.
5. **Pausable은 신규 유입만 막는다.** `createPool / take / createFiatTrade / joinFiatTrade`는 pause 시 revert. `cancel / expire / expireFiatTrade / confirmReceived / resolveDispute`는 pause 중에도 동작(자금 회수 보장).
6. **누구나 만료 트리거.** 키퍼 역할 없음.
7. **재진입 방어**: 모든 자금 이동 함수 `nonReentrant`. 상태 변경 → 전송 순서(CEI).

## 2. 상수·권한

```solidity
uint16 public constant MAX_FEE_BPS = 100;       // 1%
uint16 public constant MAX_PENALTY_BPS = 5000;  // 몰수 담보 중 플랫폼 몫 최대 50%
uint64 public constant MAX_POOL_DURATION = 30 days;
uint64 public constant MAX_TRADE_DURATION = 7 days;
uint64 public constant MAX_RELEASE_WINDOW = 3 days;

bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
// DEFAULT_ADMIN_ROLE: setFees, setFeeRecipient, 역할 부여

uint16 public feeBps;        // 초기 30 (0.3%)
uint16 public penaltyBps;    // 초기 1000 (10%)
address public feeRecipient;
```

`constructor(address admin, address feeRecipient_, uint16 feeBps_, uint16 penaltyBps_)`.
`setFees(uint16 feeBps_, uint16 penaltyBps_)` — 상한 검사, `FeesUpdated` 이벤트.
`setFeeRecipient(address)` — 0 주소 금지, `FeeRecipientUpdated`.

## 3. 스왑 풀 (Public Market · VIP crypto↔crypto)

```solidity
enum PoolStatus { OPEN, FILLED, CANCELLED, EXPIRED }

struct Pool {
    address maker;
    address offerToken;      // address(0) = native
    address requestToken;
    uint256 offerAmount;     // 실수령 예치량 (가격 기준 분모)
    uint256 offerRemaining;  // 남은 예치량
    uint256 requestAmount;   // offerAmount 전량에 대한 요구량 (가격 기준 분자)
    uint64  expiresAt;
    bool    allowPartial;
    uint16  feeBps;          // 생성 시점 스냅샷
    PoolStatus status;
}
uint256 public nextPoolId = 1;
mapping(uint256 => Pool) public pools;
```

### createPool
```solidity
function createPool(
    address offerToken, uint256 offerAmount,
    address requestToken, uint256 requestAmount,
    uint64 expiresAt, bool allowPartial
) external payable whenNotPaused nonReentrant returns (uint256 poolId);
```
- require: `offerToken != requestToken`, `offerAmount > 0`, `requestAmount > 0`, `block.timestamp < expiresAt <= block.timestamp + MAX_POOL_DURATION`.
- `received = _pull(offerToken, offerAmount)` (네이티브: `msg.value == offerAmount`; ERC-20: `msg.value == 0`, balance-diff).
- `offerAmount = received`, `offerRemaining = received`. `requestAmount`는 그대로(가격은 received 기준으로 재해석됨 — 수수료 토큰이면 maker가 감수).
- emit `PoolCreated(poolId, maker, offerToken, received, requestToken, requestAmount, expiresAt, allowPartial, feeBps)`.

### take
```solidity
function take(uint256 poolId, uint256 offerWanted) external payable whenNotPaused nonReentrant;
```
- require: status OPEN, `block.timestamp < expiresAt`, `msg.sender != maker`, `0 < offerWanted <= offerRemaining`, `allowPartial || offerWanted == offerRemaining`.
- `requestDue = ceilDiv(requestAmount * offerWanted, offerAmount)`.
- `paid = _pull(requestToken, requestDue)` (네이티브: `msg.value == requestDue`).
- `feeOffer = offerWanted * feeBps / 10000`, `feeReq = paid * feeBps / 10000`.
- 상태 먼저: `offerRemaining -= offerWanted`; `if (offerRemaining == 0) status = FILLED`.
- 전송: `_push(offerToken, msg.sender, offerWanted - feeOffer)`, `_push(offerToken, feeRecipient, feeOffer)`, `_push(requestToken, maker, paid - feeReq)`, `_push(requestToken, feeRecipient, feeReq)`.
- emit `PoolTaken(poolId, taker, offerWanted, paid, feeOffer, feeReq, offerRemaining)`.

### cancel / expire
```solidity
function cancel(uint256 poolId) external nonReentrant;          // maker only, status OPEN
function expire(uint256 poolId) external nonReentrant;          // anyone, status OPEN && block.timestamp >= expiresAt
```
- 둘 다: `amt = offerRemaining; offerRemaining = 0; status = CANCELLED|EXPIRED; _push(offerToken, maker, amt)`.
- emit `PoolCancelled(poolId, refunded)` / `PoolExpired(poolId, refunded)`.

## 4. Fiat 트레이드 (VIP Desk KRW↔crypto)

풀은 오프체인 광고(DB). 매칭 후 **크립토 판매자(seller)** 가 온체인 트레이드를 만들고 **KRW 구매자(buyer)** 가 담보를 넣는다(담보 0이면 즉시 ACTIVE).

```solidity
enum TradeStatus { AWAITING_BOND, ACTIVE, PAID, RELEASED, CANCELLED, EXPIRED, DISPUTED, RESOLVED }

struct FiatTrade {
    address seller;        // 크립토 락
    address buyer;         // KRW 송금자
    address token;  uint256 amount;       // 락된 크립토 (실수령)
    address bondToken; uint256 bondAmount; // buyer 담보 요구량 (0 = 없음). 예치 후 실수령량으로 갱신
    uint64  deadline;      // buyer가 markPaid 해야 하는 기한
    uint64  releaseWindow; // PAID 이후 seller 확인 유예. 지나면 누구나 DISPUTED로 승격 가능
    uint64  paidAt;
    uint16  feeBps;
    TradeStatus status;
    bytes32 evidenceHash;
}
uint256 public nextTradeId = 1;
mapping(uint256 => FiatTrade) public trades;
mapping(uint256 => mapping(address => bool)) public cancelApprovals;
```

### 함수
```solidity
function createFiatTrade(address buyer, address token, uint256 amount,
    address bondToken, uint256 bondAmount, uint64 deadline, uint64 releaseWindow)
    external payable whenNotPaused nonReentrant returns (uint256 tradeId);
// require buyer != 0 && buyer != msg.sender, amount > 0, now < deadline <= now + MAX_TRADE_DURATION, releaseWindow <= MAX_RELEASE_WINDOW
// received = _pull(token, amount); status = bondAmount > 0 ? AWAITING_BOND : ACTIVE
// emit FiatTradeCreated(tradeId, seller, buyer, token, received, bondToken, bondAmount, deadline, releaseWindow, feeBps)

function joinFiatTrade(uint256 tradeId) external payable whenNotPaused nonReentrant;
// buyer only, AWAITING_BOND, now < deadline; bondAmount = _pull(bondToken, bondAmount); status = ACTIVE; emit FiatTradeJoined(tradeId, bondReceived)

function markPaid(uint256 tradeId) external;
// buyer only, ACTIVE, now < deadline; paidAt = now; status = PAID; emit FiatTradePaid(tradeId)

function confirmReceived(uint256 tradeId) external nonReentrant;
// seller only, PAID (ACTIVE도 허용 — seller가 먼저 확인해도 됨); status = RELEASED
// fee = amount * feeBps / 10000; amount=0; bond=0 처리 후: token→buyer (amount-fee), token→feeRecipient (fee), bondToken→buyer (bond)
// emit FiatTradeReleased(tradeId, fee)

function cancelFiatTrade(uint256 tradeId) external nonReentrant;
// AWAITING_BOND: seller 단독 취소 (buyer 미참여). ACTIVE: 양측 승인 필요(cancelApprovals) — 두 번째 승인자가 호출할 때 실행.
// PAID 이후 취소 불가. 환불: token→seller, bond→buyer. status = CANCELLED. emit FiatTradeCancelled(tradeId)

function expireFiatTrade(uint256 tradeId) external nonReentrant;
// anyone. (AWAITING_BOND || ACTIVE) && now >= deadline. token→seller, bond→buyer. status = EXPIRED. emit FiatTradeExpired(tradeId)

function raiseDispute(uint256 tradeId, bytes32 evidenceHash) external;
// seller 또는 buyer, status ACTIVE || PAID. status = DISPUTED. emit FiatTradeDisputed(tradeId, msg.sender, evidenceHash)

function escalateUnreleased(uint256 tradeId) external;
// anyone. status PAID && now >= paidAt + releaseWindow. status = DISPUTED, evidenceHash = 0. emit FiatTradeDisputed(tradeId, msg.sender, 0)
// buyer 보호: seller가 잠수하면 중재로 넘어간다 (자동 릴리즈는 하지 않는다 — 송금 사실을 체인이 알 수 없음)

function resolveDispute(uint256 tradeId, bool buyerWins) external onlyRole(ARBITRATOR_ROLE) nonReentrant;
// DISPUTED only. status = RESOLVED.
// buyerWins: fee = amount*feeBps/1e4; token→buyer (amount-fee); token→feeRecipient (fee); bond→buyer
// sellerWins: token→seller (전액, 수수료 없음); penalty = bond*penaltyBps/1e4 → feeRecipient; bond-penalty → seller (D2)
// emit FiatTradeResolved(tradeId, buyerWins, amountToWinner, penalty)
```

## 5. 내부 헬퍼

```solidity
function _pull(address token, uint256 amount) internal returns (uint256 received) {
    if (token == address(0)) { require(msg.value == amount, "BAD_VALUE"); return amount; }
    require(msg.value == 0, "NO_VALUE");
    uint256 before = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    received = IERC20(token).balanceOf(address(this)) - before;
    require(received > 0, "ZERO_RECEIVED");
}
function _push(address token, address to, uint256 amount) internal {
    if (amount == 0) return;
    if (token == address(0)) { (bool ok,) = to.call{value: amount}(""); require(ok, "ETH_SEND"); }
    else IERC20(token).safeTransfer(to, amount);
}
```
- `receive()` 없음 (직접 송금 거부). `_push` 네이티브 실패 시 revert — 수취자가 컨트랙트라 받지 못하면 그 거래는 실패한다(pull 패턴 도입은 감사 항목 CODEX-C3).

## 6. 이벤트 (인덱서 계약)

```
PoolCreated(uint256 indexed poolId, address indexed maker, address offerToken, uint256 offerAmount, address requestToken, uint256 requestAmount, uint64 expiresAt, bool allowPartial, uint16 feeBps)
PoolTaken(uint256 indexed poolId, address indexed taker, uint256 offerOut, uint256 requestIn, uint256 feeOffer, uint256 feeRequest, uint256 offerRemaining)
PoolCancelled(uint256 indexed poolId, uint256 refunded)
PoolExpired(uint256 indexed poolId, uint256 refunded)
FiatTradeCreated(uint256 indexed tradeId, address indexed seller, address indexed buyer, address token, uint256 amount, address bondToken, uint256 bondAmount, uint64 deadline, uint64 releaseWindow, uint16 feeBps)
FiatTradeJoined(uint256 indexed tradeId, uint256 bondReceived)
FiatTradePaid(uint256 indexed tradeId)
FiatTradeReleased(uint256 indexed tradeId, uint256 fee)
FiatTradeCancelled(uint256 indexed tradeId)
FiatTradeExpired(uint256 indexed tradeId)
FiatTradeDisputed(uint256 indexed tradeId, address indexed raisedBy, bytes32 evidenceHash)
FiatTradeResolved(uint256 indexed tradeId, bool buyerWins, uint256 amountToWinner, uint256 penalty)
FeesUpdated(uint16 feeBps, uint16 penaltyBps)
FeeRecipientUpdated(address feeRecipient)
```

## 7. 뷰
```
getPool(uint256) returns (Pool memory)
getFiatTrade(uint256) returns (FiatTrade memory)
quoteTake(uint256 poolId, uint256 offerWanted) returns (uint256 requestDue, uint256 feeOffer, uint256 feeRequestEstimate)
```

## 8. 테스트 요구 (Hardhat, `contracts/test/EscrowVault.v2.test.js`)

- 스왑: 전량 체결 / 부분 체결 2회 → FILLED / allowPartial=false에서 부분 시도 revert / 네이티브 offer + ERC20 request / ERC20 offer + 네이티브 request / 잘못된 msg.value revert / 자기 풀 테이크 revert / 만료 후 take revert / cancel 후 잔액 정확 / expire는 만료 전 revert, 후 누구나 성공 / 수수료 정확(양 레그) / 수수료 토큰(FeeOnTransferMock)에서 offerAmount = 실수령
- Fiat: 담보 없이 ACTIVE 즉시 / 담보 join → ACTIVE / markPaid → confirmReceived 정산·담보 반환 / deadline 경과 expire (token→seller, bond→buyer) / PAID 상태 expire revert / raiseDispute → resolve buyerWins·sellerWins 금액·페널티 검증 / escalateUnreleased는 releaseWindow 전 revert 후 성공 / mutual cancel 2단계 / AWAITING_BOND seller 단독 취소
- 권한·안전: pause 시 create/take revert, cancel/expire 성공 / setFees 상한 revert / 재진입 공격 mock(ReentrantTaker)이 실패 / 비ARBITRATOR resolve revert
- 가스 리포트 출력

## 9. 배포·산출물

- `contracts/scripts/deploy.js`: `EscrowVault(admin, feeRecipient, 30, 1000)` 배포 → `deployments/<chainId>.json` 기록 → `src/lib/contracts/addresses.ts` 갱신.
- `contracts/scripts/export-abi.js`: artifacts → `src/lib/contracts/abi.ts` (`export const escrowVaultAbi = [...] as const`).
- 환경변수: `SEPOLIA_RPC_URL`, `POLYGON_RPC_URL`, `BSC_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `FEE_RECIPIENT`, `ETHERSCAN_API_KEY`, `POLYGONSCAN_API_KEY`.
