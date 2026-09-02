// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EscrowVault v2
 * @notice Atomic P2P OTC trading with swap pools and fiat-backed trades
 * @dev Spec: docs/CONTRACT_V2_SPEC.md
 *
 * Custom errors:
 * - BadValue: msg.value mismatch
 * - NoValue: msg.value sent when not expected
 * - NotMaker: caller is not the pool maker
 * - NotSeller: caller is not the trade seller
 * - NotBuyer: caller is not the trade buyer
 * - NotParty: caller is neither seller nor buyer
 * - PoolNotOpen: pool status is not OPEN
 * - TradeNotActive: trade status is not ACTIVE or expected status
 * - Expired: deadline has passed
 * - NotExpired: deadline has not passed yet
 * - PartialNotAllowed: pool does not allow partial fills
 * - SelfTake: maker cannot take own pool
 * - FeeTooHigh: fee exceeds maximum
 * - InvalidAmount: amount is zero or invalid
 * - InvalidAddress: address is zero or invalid
 * - InvalidDeadline: deadline is invalid
 * - InvalidToken: token addresses match or are invalid
 * - ZeroReceived: balance diff is zero
 */
contract EscrowVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════════════════════
    // CONSTANTS & ROLES
    // ══════════════════════════════════════════════════════════════════════════════

    uint16 public constant MAX_FEE_BPS = 100;           // 1%
    uint16 public constant MAX_PENALTY_BPS = 5000;      // 50%
    uint64 public constant MAX_POOL_DURATION = 30 days;
    uint64 public constant MAX_TRADE_DURATION = 7 days;
    uint64 public constant MAX_RELEASE_WINDOW = 3 days;

    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════════════

    error BadValue();
    error NoValue();
    error NotMaker();
    error NotSeller();
    error NotBuyer();
    error NotParty();
    error PoolNotOpen();
    error TradeNotActive();
    error Expired();
    error NotExpired();
    error PartialNotAllowed();
    error SelfTake();
    error FeeTooHigh();
    error InvalidAmount();
    error InvalidAddress();
    error InvalidDeadline();
    error InvalidToken();
    error ZeroReceived();
    error EthSendFailed();
    error StatusNotAwaiting();
    error StatusNotPaid();
    error StatusNotDisputed();
    error AlreadyApproved();

    // ══════════════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════════════

    uint16 public feeBps;
    uint16 public penaltyBps;
    address public feeRecipient;

    // ══════════════════════════════════════════════════════════════════════════════
    // SWAP POOLS
    // ══════════════════════════════════════════════════════════════════════════════

    enum PoolStatus { OPEN, FILLED, CANCELLED, EXPIRED }

    struct Pool {
        address maker;
        address offerToken;         // address(0) = native
        address requestToken;
        uint256 offerAmount;        // total received (price base)
        uint256 offerRemaining;
        uint256 requestAmount;      // total request for full offer
        uint64  expiresAt;
        bool    allowPartial;
        uint16  feeBps;             // snapshot at creation
        PoolStatus status;
    }

    uint256 public nextPoolId = 1;
    mapping(uint256 => Pool) public pools;

    // ══════════════════════════════════════════════════════════════════════════════
    // FIAT TRADES
    // ══════════════════════════════════════════════════════════════════════════════

    enum TradeStatus {
        AWAITING_BOND,  // 0
        ACTIVE,         // 1
        PAID,           // 2
        RELEASED,       // 3
        CANCELLED,      // 4
        EXPIRED,        // 5
        DISPUTED,       // 6
        RESOLVED        // 7
    }

    struct FiatTrade {
        address seller;
        address buyer;
        address token;
        uint256 amount;             // locked crypto (received)
        address bondToken;
        uint256 bondAmount;         // buyer collateral (received)
        uint64  deadline;           // buyer must markPaid before this
        uint64  releaseWindow;
        uint64  paidAt;
        uint16  feeBps;
        TradeStatus status;
        bytes32 evidenceHash;
    }

    uint256 public nextTradeId = 1;
    mapping(uint256 => FiatTrade) public trades;
    mapping(uint256 => mapping(address => bool)) public cancelApprovals;

    // ══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════════════

    event PoolCreated(
        uint256 indexed poolId,
        address indexed maker,
        address offerToken,
        uint256 offerAmount,
        address requestToken,
        uint256 requestAmount,
        uint64 expiresAt,
        bool allowPartial,
        uint16 feeBps
    );
    event PoolTaken(
        uint256 indexed poolId,
        address indexed taker,
        uint256 offerOut,
        uint256 requestIn,
        uint256 feeOffer,
        uint256 feeRequest,
        uint256 offerRemaining
    );
    event PoolCancelled(uint256 indexed poolId, uint256 refunded);
    event PoolExpired(uint256 indexed poolId, uint256 refunded);

    event FiatTradeCreated(
        uint256 indexed tradeId,
        address indexed seller,
        address indexed buyer,
        address token,
        uint256 amount,
        address bondToken,
        uint256 bondAmount,
        uint64 deadline,
        uint64 releaseWindow,
        uint16 feeBps
    );
    event FiatTradeJoined(uint256 indexed tradeId, uint256 bondReceived);
    event FiatTradePaid(uint256 indexed tradeId);
    event FiatTradeReleased(uint256 indexed tradeId, uint256 fee);
    event FiatTradeCancelled(uint256 indexed tradeId);
    event FiatTradeExpired(uint256 indexed tradeId);
    event FiatTradeDisputed(uint256 indexed tradeId, address indexed raisedBy, bytes32 evidenceHash);
    event FiatTradeResolved(uint256 indexed tradeId, bool buyerWins, uint256 amountToWinner, uint256 penalty);

    event FeesUpdated(uint16 feeBps, uint16 penaltyBps);
    event FeeRecipientUpdated(address feeRecipient);

    // ══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════════════

    constructor(
        address admin,
        address feeRecipient_,
        uint16 feeBps_,
        uint16 penaltyBps_
    ) {
        if (admin == address(0)) revert InvalidAddress();
        if (feeRecipient_ == address(0)) revert InvalidAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (penaltyBps_ > MAX_PENALTY_BPS) revert FeeTooHigh();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        penaltyBps = penaltyBps_;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ══════════════════════════════════════════════════════════════════════════════

    function setFees(uint16 feeBps_, uint16 penaltyBps_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (penaltyBps_ > MAX_PENALTY_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        penaltyBps = penaltyBps_;
        emit FeesUpdated(feeBps_, penaltyBps_);
    }

    function setFeeRecipient(address feeRecipient_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (feeRecipient_ == address(0)) revert InvalidAddress();
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // SWAP POOLS
    // ══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new swap pool and lock offer assets
     * @param offerToken Token to offer (address(0) for native)
     * @param offerAmount Amount to offer
     * @param requestToken Token to request
     * @param requestAmount Amount requested for full offer
     * @param expiresAt Expiration timestamp
     * @param allowPartial Allow partial fills
     * @return poolId The created pool ID
     */
    function createPool(
        address offerToken,
        uint256 offerAmount,
        address requestToken,
        uint256 requestAmount,
        uint64 expiresAt,
        bool allowPartial
    ) external payable whenNotPaused nonReentrant returns (uint256 poolId) {
        if (offerToken == requestToken) revert InvalidToken();
        if (offerAmount == 0) revert InvalidAmount();
        if (requestAmount == 0) revert InvalidAmount();
        if (block.timestamp >= expiresAt) revert InvalidDeadline();
        if (expiresAt > block.timestamp + MAX_POOL_DURATION) revert InvalidDeadline();

        uint256 received = _pull(offerToken, offerAmount);

        poolId = nextPoolId++;
        Pool storage pool = pools[poolId];
        pool.maker = msg.sender;
        pool.offerToken = offerToken;
        pool.requestToken = requestToken;
        pool.offerAmount = received;
        pool.offerRemaining = received;
        pool.requestAmount = requestAmount;
        pool.expiresAt = expiresAt;
        pool.allowPartial = allowPartial;
        pool.feeBps = feeBps;
        pool.status = PoolStatus.OPEN;

        emit PoolCreated(
            poolId,
            msg.sender,
            offerToken,
            received,
            requestToken,
            requestAmount,
            expiresAt,
            allowPartial,
            feeBps
        );
    }

    /**
     * @notice Take (fill) a pool atomically
     * @param poolId Pool to take from
     * @param offerWanted Amount of offer token desired
     */
    function take(uint256 poolId, uint256 offerWanted)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Pool storage pool = pools[poolId];

        if (pool.status != PoolStatus.OPEN) revert PoolNotOpen();
        if (block.timestamp >= pool.expiresAt) revert Expired();
        if (msg.sender == pool.maker) revert SelfTake();
        if (offerWanted == 0 || offerWanted > pool.offerRemaining) revert InvalidAmount();
        if (!pool.allowPartial && offerWanted != pool.offerRemaining) revert PartialNotAllowed();

        // Calculate request due (ceil division for precision)
        uint256 requestDue = _ceilDiv(pool.requestAmount * offerWanted, pool.offerAmount);
        uint256 paid = _pull(pool.requestToken, requestDue);

        uint256 feeOffer = (offerWanted * pool.feeBps) / 10000;
        uint256 feeReq = (paid * pool.feeBps) / 10000;

        // Update state first (CEI)
        pool.offerRemaining -= offerWanted;
        if (pool.offerRemaining == 0) {
            pool.status = PoolStatus.FILLED;
        }

        // Push assets
        _push(pool.offerToken, msg.sender, offerWanted - feeOffer);
        _push(pool.offerToken, feeRecipient, feeOffer);
        _push(pool.requestToken, pool.maker, paid - feeReq);
        _push(pool.requestToken, feeRecipient, feeReq);

        emit PoolTaken(poolId, msg.sender, offerWanted, paid, feeOffer, feeReq, pool.offerRemaining);
    }

    /**
     * @notice Cancel pool (maker only)
     * @param poolId Pool to cancel
     */
    function cancel(uint256 poolId) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (msg.sender != pool.maker) revert NotMaker();
        if (pool.status != PoolStatus.OPEN) revert PoolNotOpen();

        uint256 refund = pool.offerRemaining;
        pool.offerRemaining = 0;
        pool.status = PoolStatus.CANCELLED;

        _push(pool.offerToken, pool.maker, refund);
        emit PoolCancelled(poolId, refund);
    }

    /**
     * @notice Expire a pool past its deadline (anyone can call)
     * @param poolId Pool to expire
     */
    function expire(uint256 poolId) external nonReentrant {
        Pool storage pool = pools[poolId];
        if (pool.status != PoolStatus.OPEN) revert PoolNotOpen();
        if (block.timestamp < pool.expiresAt) revert NotExpired();

        uint256 refund = pool.offerRemaining;
        pool.offerRemaining = 0;
        pool.status = PoolStatus.EXPIRED;

        _push(pool.offerToken, pool.maker, refund);
        emit PoolExpired(poolId, refund);
    }

    /**
     * @notice Quote a take operation
     * @param poolId Pool ID
     * @param offerWanted Amount of offer wanted
     * @return requestDue Amount of request token due
     * @return feeOffer Fee on offer leg
     * @return feeRequestEstimate Estimated fee on request leg
     */
    function quoteTake(uint256 poolId, uint256 offerWanted)
        external
        view
        returns (uint256 requestDue, uint256 feeOffer, uint256 feeRequestEstimate)
    {
        Pool storage pool = pools[poolId];
        requestDue = _ceilDiv(pool.requestAmount * offerWanted, pool.offerAmount);
        feeOffer = (offerWanted * pool.feeBps) / 10000;
        feeRequestEstimate = (requestDue * pool.feeBps) / 10000;
    }

    /**
     * @notice Get pool details
     * @param poolId Pool ID
     * @return Pool struct
     */
    function getPool(uint256 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // FIAT TRADES
    // ══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a fiat-backed trade (seller locks crypto)
     * @param buyer Buyer address (KRW sender)
     * @param token Crypto token to lock
     * @param amount Crypto amount to lock
     * @param bondToken Buyer collateral token
     * @param bondAmount Buyer collateral amount (0 = no collateral)
     * @param deadline Buyer must mark paid before this
     * @param releaseWindow Seller has this long to confirm after paid
     * @return tradeId Trade ID
     */
    function createFiatTrade(
        address buyer,
        address token,
        uint256 amount,
        address bondToken,
        uint256 bondAmount,
        uint64 deadline,
        uint64 releaseWindow
    ) external payable whenNotPaused nonReentrant returns (uint256 tradeId) {
        if (buyer == address(0)) revert InvalidAddress();
        if (buyer == msg.sender) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (block.timestamp >= deadline) revert InvalidDeadline();
        if (deadline > block.timestamp + MAX_TRADE_DURATION) revert InvalidDeadline();
        if (releaseWindow > MAX_RELEASE_WINDOW) revert InvalidDeadline();

        uint256 received = _pull(token, amount);

        tradeId = nextTradeId++;
        FiatTrade storage trade = trades[tradeId];
        trade.seller = msg.sender;
        trade.buyer = buyer;
        trade.token = token;
        trade.amount = received;
        trade.bondToken = bondToken;
        trade.bondAmount = bondAmount;
        trade.deadline = deadline;
        trade.releaseWindow = releaseWindow;
        trade.feeBps = feeBps;
        trade.status = bondAmount > 0 ? TradeStatus.AWAITING_BOND : TradeStatus.ACTIVE;

        emit FiatTradeCreated(
            tradeId,
            msg.sender,
            buyer,
            token,
            received,
            bondToken,
            bondAmount,
            deadline,
            releaseWindow,
            feeBps
        );
    }

    /**
     * @notice Buyer joins by locking collateral
     * @param tradeId Trade ID
     */
    function joinFiatTrade(uint256 tradeId) external payable whenNotPaused nonReentrant {
        FiatTrade storage trade = trades[tradeId];
        if (msg.sender != trade.buyer) revert NotBuyer();
        if (trade.status != TradeStatus.AWAITING_BOND) revert StatusNotAwaiting();
        if (block.timestamp >= trade.deadline) revert Expired();

        uint256 bondReceived = _pull(trade.bondToken, trade.bondAmount);
        trade.bondAmount = bondReceived;
        trade.status = TradeStatus.ACTIVE;

        emit FiatTradeJoined(tradeId, bondReceived);
    }

    /**
     * @notice Buyer marks fiat payment sent
     * @param tradeId Trade ID
     */
    function markPaid(uint256 tradeId) external {
        FiatTrade storage trade = trades[tradeId];
        if (msg.sender != trade.buyer) revert NotBuyer();
        if (trade.status != TradeStatus.ACTIVE) revert TradeNotActive();
        if (block.timestamp >= trade.deadline) revert Expired();

        trade.paidAt = uint64(block.timestamp);
        trade.status = TradeStatus.PAID;

        emit FiatTradePaid(tradeId);
    }

    /**
     * @notice Seller confirms fiat received and releases crypto
     * @param tradeId Trade ID
     */
    function confirmReceived(uint256 tradeId) external nonReentrant {
        FiatTrade storage trade = trades[tradeId];
        if (msg.sender != trade.seller) revert NotSeller();
        // Allow confirmation from ACTIVE or PAID
        if (trade.status != TradeStatus.ACTIVE && trade.status != TradeStatus.PAID) {
            revert TradeNotActive();
        }

        uint256 fee = (trade.amount * trade.feeBps) / 10000;
        uint256 amountToBuyer = trade.amount - fee;
        uint256 bondToReturn = trade.bondAmount;

        // Zero out first
        trade.amount = 0;
        trade.bondAmount = 0;
        trade.status = TradeStatus.RELEASED;

        // Push
        _push(trade.token, trade.buyer, amountToBuyer);
        _push(trade.token, feeRecipient, fee);
        if (bondToReturn > 0) {
            _push(trade.bondToken, trade.buyer, bondToReturn);
        }

        emit FiatTradeReleased(tradeId, fee);
    }

    /**
     * @notice Cancel fiat trade (seller unilateral if AWAITING_BOND, mutual if ACTIVE)
     * @param tradeId Trade ID
     */
    function cancelFiatTrade(uint256 tradeId) external nonReentrant {
        FiatTrade storage trade = trades[tradeId];
        if (msg.sender != trade.seller && msg.sender != trade.buyer) revert NotParty();

        bool bondWasLocked = false;

        if (trade.status == TradeStatus.AWAITING_BOND) {
            // Seller can cancel unilaterally
            if (msg.sender != trade.seller) revert NotSeller();
            // Bond was never locked
            bondWasLocked = false;
        } else if (trade.status == TradeStatus.ACTIVE) {
            // Mutual approval required
            if (cancelApprovals[tradeId][msg.sender]) revert AlreadyApproved();
            cancelApprovals[tradeId][msg.sender] = true;

            bool bothApproved = cancelApprovals[tradeId][trade.seller] &&
                               cancelApprovals[tradeId][trade.buyer];
            if (!bothApproved) {
                return; // Wait for other party
            }
            // Bond was locked in ACTIVE
            bondWasLocked = true;
        } else {
            revert TradeNotActive();
        }

        uint256 amountToSeller = trade.amount;
        uint256 bondToBuyer = bondWasLocked ? trade.bondAmount : 0;
        trade.amount = 0;
        trade.bondAmount = 0;
        trade.status = TradeStatus.CANCELLED;

        _push(trade.token, trade.seller, amountToSeller);
        if (bondToBuyer > 0) {
            _push(trade.bondToken, trade.buyer, bondToBuyer);
        }

        emit FiatTradeCancelled(tradeId);
    }

    /**
     * @notice Expire trade past deadline (anyone can call)
     * @param tradeId Trade ID
     */
    function expireFiatTrade(uint256 tradeId) external nonReentrant {
        FiatTrade storage trade = trades[tradeId];
        if (trade.status != TradeStatus.AWAITING_BOND && trade.status != TradeStatus.ACTIVE) {
            revert TradeNotActive();
        }
        if (block.timestamp < trade.deadline) revert NotExpired();

        uint256 amountToSeller = trade.amount;
        uint256 bondToBuyer = trade.bondAmount;
        trade.amount = 0;
        trade.bondAmount = 0;
        trade.status = TradeStatus.EXPIRED;

        _push(trade.token, trade.seller, amountToSeller);
        if (bondToBuyer > 0) {
            _push(trade.bondToken, trade.buyer, bondToBuyer);
        }

        emit FiatTradeExpired(tradeId);
    }

    /**
     * @notice Raise a dispute
     * @param tradeId Trade ID
     * @param evidenceHash IPFS or storage hash of evidence
     */
    function raiseDispute(uint256 tradeId, bytes32 evidenceHash) external {
        FiatTrade storage trade = trades[tradeId];
        if (msg.sender != trade.seller && msg.sender != trade.buyer) revert NotParty();
        if (trade.status != TradeStatus.ACTIVE && trade.status != TradeStatus.PAID) {
            revert TradeNotActive();
        }

        trade.status = TradeStatus.DISPUTED;
        trade.evidenceHash = evidenceHash;

        emit FiatTradeDisputed(tradeId, msg.sender, evidenceHash);
    }

    /**
     * @notice Escalate unreleased trade to dispute (after release window expires)
     * @param tradeId Trade ID
     */
    function escalateUnreleased(uint256 tradeId) external {
        FiatTrade storage trade = trades[tradeId];
        if (trade.status != TradeStatus.PAID) revert StatusNotPaid();
        if (block.timestamp < trade.paidAt + trade.releaseWindow) revert NotExpired();

        trade.status = TradeStatus.DISPUTED;
        trade.evidenceHash = bytes32(0);

        emit FiatTradeDisputed(tradeId, msg.sender, bytes32(0));
    }

    /**
     * @notice Arbitrator resolves dispute
     * @param tradeId Trade ID
     * @param buyerWins True if buyer wins
     */
    function resolveDispute(uint256 tradeId, bool buyerWins)
        external
        onlyRole(ARBITRATOR_ROLE)
        nonReentrant
    {
        FiatTrade storage trade = trades[tradeId];
        if (trade.status != TradeStatus.DISPUTED) revert StatusNotDisputed();

        trade.status = TradeStatus.RESOLVED;

        uint256 amountToWinner;
        uint256 penalty = 0;

        if (buyerWins) {
            // Buyer wins: gets crypto - fee, bond returned
            uint256 fee = (trade.amount * trade.feeBps) / 10000;
            amountToWinner = trade.amount - fee;

            uint256 bondReturn = trade.bondAmount;
            trade.amount = 0;
            trade.bondAmount = 0;

            _push(trade.token, trade.buyer, amountToWinner);
            _push(trade.token, feeRecipient, fee);
            if (bondReturn > 0) {
                _push(trade.bondToken, trade.buyer, bondReturn);
            }
        } else {
            // Seller wins: gets crypto back (no fee), penalty from bond
            amountToWinner = trade.amount;
            penalty = (trade.bondAmount * penaltyBps) / 10000;
            uint256 bondToSeller = trade.bondAmount - penalty;

            trade.amount = 0;
            trade.bondAmount = 0;

            _push(trade.token, trade.seller, amountToWinner);
            if (penalty > 0) {
                _push(trade.bondToken, feeRecipient, penalty);
            }
            if (bondToSeller > 0) {
                _push(trade.bondToken, trade.seller, bondToSeller);
            }
        }

        emit FiatTradeResolved(tradeId, buyerWins, amountToWinner, penalty);
    }

    /**
     * @notice Get fiat trade details
     * @param tradeId Trade ID
     * @return FiatTrade struct
     */
    function getFiatTrade(uint256 tradeId) external view returns (FiatTrade memory) {
        return trades[tradeId];
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════════════════════

    /**
     * @dev Pull tokens from sender, handle fee-on-transfer
     * @param token Token address (address(0) for native)
     * @param amount Expected amount
     * @return received Actual received amount
     */
    function _pull(address token, uint256 amount) internal returns (uint256 received) {
        if (token == address(0)) {
            if (msg.value != amount) revert BadValue();
            return amount;
        }
        if (msg.value != 0) revert NoValue();

        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - before;
        if (received == 0) revert ZeroReceived();
    }

    /**
     * @dev Push tokens to recipient
     * @param token Token address (address(0) for native)
     * @param to Recipient
     * @param amount Amount to send
     */
    function _push(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert EthSendFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @dev Ceiling division
     */
    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
