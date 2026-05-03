// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @notice OTC Pool Registry - handles pool creation, matching, and soft-lock
contract PoolRegistry is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant MATCHING_ENGINE_ROLE = keccak256("MATCHING_ENGINE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum PoolStatus { OPEN, PARTIAL, MATCHED, CANCELLED, COMPLETED }

    struct AssetBundle {
        address[] tokens;    // ERC-20 addresses (address(0) = native)
        uint256[] amounts;
        bool isFiat;
        bytes3 fiatCurrency; // ISO 4217: "KRW", "USD"
        uint256 fiatAmount;
    }

    struct Pool {
        uint256 poolId;
        address creator;
        AssetBundle offer;
        AssetBundle request;
        uint256 depositAmount;
        address depositToken;
        PoolStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 filledPercent; // 0-10000 basis points
    }

    uint256 public nextPoolId = 1;
    mapping(uint256 => Pool) public pools;
    mapping(address => uint256[]) public userPools;

    // Soft-locked assets per pool
    mapping(uint256 => mapping(address => uint256)) public lockedERC20;
    mapping(uint256 => uint256) public lockedNative;

    event PoolRegistered(uint256 indexed poolId, address indexed creator, bool isFiat);
    event PoolCancelled(uint256 indexed poolId);
    event PoolFillUpdated(uint256 indexed poolId, uint256 filledPercent);
    event PoolCompleted(uint256 indexed poolId);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    /// @notice Register a new pool with soft-lock of offer assets
    function registerPool(
        address[] calldata offerTokens,
        uint256[] calldata offerAmounts,
        address[] calldata requestTokens,
        uint256[] calldata requestAmounts,
        bool isFiat,
        bytes3 fiatCurrency,
        uint256 fiatAmount,
        uint256 depositAmount,
        address depositToken,
        uint256 expiresAt
    ) external payable nonReentrant returns (uint256 poolId) {
        require(expiresAt > block.timestamp, "Invalid expiry");
        require(offerTokens.length == offerAmounts.length, "Length mismatch");

        poolId = nextPoolId++;
        Pool storage pool = pools[poolId];
        pool.poolId = poolId;
        pool.creator = msg.sender;
        pool.createdAt = block.timestamp;
        pool.expiresAt = expiresAt;
        pool.status = PoolStatus.OPEN;
        pool.depositAmount = depositAmount;
        pool.depositToken = depositToken;

        // Offer asset bundle
        pool.offer.tokens = offerTokens;
        pool.offer.amounts = offerAmounts;

        // Request asset bundle
        pool.request.tokens = requestTokens;
        pool.request.amounts = requestAmounts;
        pool.request.isFiat = isFiat;
        pool.request.fiatCurrency = fiatCurrency;
        pool.request.fiatAmount = fiatAmount;

        // Soft lock offer assets
        uint256 nativeRequired = 0;
        for (uint i = 0; i < offerTokens.length; i++) {
            if (offerTokens[i] == address(0)) {
                nativeRequired += offerAmounts[i];
                lockedNative[poolId] += offerAmounts[i];
            } else {
                IERC20(offerTokens[i]).safeTransferFrom(msg.sender, address(this), offerAmounts[i]);
                lockedERC20[poolId][offerTokens[i]] += offerAmounts[i];
            }
        }

        // Lock deposit (always required for fiat trades)
        if (depositAmount > 0) {
            if (depositToken == address(0)) {
                nativeRequired += depositAmount;
                lockedNative[poolId] += depositAmount;
            } else {
                IERC20(depositToken).safeTransferFrom(msg.sender, address(this), depositAmount);
                lockedERC20[poolId][depositToken] += depositAmount;
            }
        }

        require(msg.value >= nativeRequired, "Insufficient ETH");

        userPools[msg.sender].push(poolId);
        emit PoolRegistered(poolId, msg.sender, isFiat);
    }

    /// @notice Cancel pool and refund locked assets
    function cancelPool(uint256 poolId) external nonReentrant {
        Pool storage pool = pools[poolId];
        require(pool.creator == msg.sender, "Not creator");
        require(pool.status == PoolStatus.OPEN || pool.status == PoolStatus.PARTIAL, "Not cancellable");

        pool.status = PoolStatus.CANCELLED;
        _refundPool(poolId, pool);
        emit PoolCancelled(poolId);
    }

    /// @notice Update fill percentage — called by matching engine
    function updateFillPercent(uint256 poolId, uint256 pct) external onlyRole(MATCHING_ENGINE_ROLE) {
        require(pct <= 10000, "Invalid pct");
        Pool storage pool = pools[poolId];
        pool.filledPercent = pct;
        if (pct >= 10000) {
            pool.status = PoolStatus.MATCHED;
        } else if (pct > 0) {
            pool.status = PoolStatus.PARTIAL;
        }
        emit PoolFillUpdated(poolId, pct);
    }

    function completePool(uint256 poolId) external onlyRole(MATCHING_ENGINE_ROLE) {
        pools[poolId].status = PoolStatus.COMPLETED;
        emit PoolCompleted(poolId);
    }

    function extendExpiry(uint256 poolId, uint256 newExpiry) external {
        Pool storage pool = pools[poolId];
        require(pool.creator == msg.sender, "Not creator");
        require(newExpiry > pool.expiresAt, "Must extend");
        pool.expiresAt = newExpiry;
    }

    function getPool(uint256 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }

    function getUserPools(address user) external view returns (uint256[] memory) {
        return userPools[user];
    }

    function _refundPool(uint256 poolId, Pool storage pool) internal {
        // Refund native
        uint256 native = lockedNative[poolId];
        if (native > 0) {
            lockedNative[poolId] = 0;
            (bool ok,) = pool.creator.call{value: native}("");
            require(ok, "ETH refund failed");
        }
        // Refund ERC-20 offer tokens
        for (uint i = 0; i < pool.offer.tokens.length; i++) {
            address token = pool.offer.tokens[i];
            if (token != address(0)) {
                uint256 amt = lockedERC20[poolId][token];
                if (amt > 0) {
                    lockedERC20[poolId][token] = 0;
                    IERC20(token).safeTransfer(pool.creator, amt);
                }
            }
        }
    }
}
