// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice EscrowVault - holds assets during OTC trades, handles settlements and disputes
contract EscrowVault is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    enum EscrowStatus { PENDING, ACTIVE, COMPLETED, DISPUTED, CANCELLED }

    struct AssetBundle {
        address[] tokens;
        uint256[] amounts;
        bool isFiat;
        bytes3 fiatCurrency;
        uint256 fiatAmount;
    }

    struct Escrow {
        uint256 escrowId;
        uint256 poolId;
        address partyA;          // Crypto provider
        address partyB;          // Fiat provider or other crypto party
        AssetBundle assetA;      // partyA locked assets
        AssetBundle assetB;      // partyB deposit (for fiat trades)
        EscrowStatus status;
        uint256 deadline;
        uint256 feeAmount;       // platform fee
        address feeToken;
        uint256 penaltyAmount;   // breach penalty
        address arbitrator;
        bytes32 disputeEvidenceHash; // IPFS hash of evidence
    }

    uint256 public nextEscrowId = 1;
    mapping(uint256 => Escrow) public escrows;
    mapping(address => uint256[]) public userEscrows;

    address public feeRecipient;
    uint256 public relayFeeBps = 50;     // 0.5%
    uint256 public depositFeeBps = 10;   // 0.1%
    uint256 public penaltyFeeBps = 1000; // 10% of penalty goes to platform

    // Locked assets per escrow
    mapping(uint256 => mapping(address => uint256)) public lockedERC20;
    mapping(uint256 => uint256) public lockedNative;

    event EscrowCreated(uint256 indexed escrowId, uint256 indexed poolId, address partyA, address partyB);
    event EscrowActivated(uint256 indexed escrowId);
    event EscrowCompleted(uint256 indexed escrowId);
    event EscrowDisputed(uint256 indexed escrowId, address raiser, bytes32 evidenceHash);
    event EscrowCancelled(uint256 indexed escrowId);
    event DisputeResolved(uint256 indexed escrowId, address winner);
    event FeeCollected(uint256 indexed escrowId, address token, uint256 amount);

    constructor(address admin, address _feeRecipient) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ARBITRATOR_ROLE, admin);
        feeRecipient = _feeRecipient;
    }

    /// @notice Create escrow and lock partyA's crypto assets
    function createEscrow(
        uint256 poolId,
        address partyB,
        address[] calldata tokensA,
        uint256[] calldata amountsA,
        bool isFiat,
        bytes3 fiatCurrency,
        uint256 fiatAmount,
        uint256 deadline,
        uint256 penaltyAmount,
        address penaltyToken
    ) external payable nonReentrant returns (uint256 escrowId) {
        require(deadline > block.timestamp, "Invalid deadline");
        require(partyB != address(0) && partyB != msg.sender, "Invalid partyB");

        escrowId = nextEscrowId++;
        Escrow storage esc = escrows[escrowId];
        esc.escrowId = escrowId;
        esc.poolId = poolId;
        esc.partyA = msg.sender;
        esc.partyB = partyB;
        esc.deadline = deadline;
        esc.status = EscrowStatus.PENDING;
        esc.penaltyAmount = penaltyAmount;

        esc.assetA.tokens = tokensA;
        esc.assetA.amounts = amountsA;
        esc.assetB.isFiat = isFiat;
        esc.assetB.fiatCurrency = fiatCurrency;
        esc.assetB.fiatAmount = fiatAmount;

        // Compute relay fee
        uint256 nativeRequired = 0;
        for (uint i = 0; i < tokensA.length; i++) {
            if (tokensA[i] == address(0)) {
                nativeRequired += amountsA[i];
                lockedNative[escrowId] += amountsA[i];
            } else {
                uint256 fee = (amountsA[i] * relayFeeBps) / 10000;
                IERC20(tokensA[i]).safeTransferFrom(msg.sender, address(this), amountsA[i] + fee);
                lockedERC20[escrowId][tokensA[i]] += amountsA[i];
                esc.feeAmount += fee;
                esc.feeToken = tokensA[i];
            }
        }

        if (nativeRequired > 0) {
            uint256 fee = (nativeRequired * relayFeeBps) / 10000;
            require(msg.value >= nativeRequired + fee, "Insufficient ETH");
            lockedNative[escrowId] = nativeRequired;
            esc.feeAmount = fee;
        }

        userEscrows[msg.sender].push(escrowId);
        userEscrows[partyB].push(escrowId);
        emit EscrowCreated(escrowId, poolId, msg.sender, partyB);
    }

    /// @notice PartyB locks deposit → ACTIVE state → chat channel opens
    function lockCounterparty(
        uint256 escrowId,
        address[] calldata tokensB,
        uint256[] calldata amountsB
    ) external payable nonReentrant {
        Escrow storage esc = escrows[escrowId];
        require(esc.partyB == msg.sender, "Not partyB");
        require(esc.status == EscrowStatus.PENDING, "Not pending");
        require(block.timestamp < esc.deadline, "Expired");

        esc.assetB.tokens = tokensB;
        esc.assetB.amounts = amountsB;

        uint256 nativeRequired = 0;
        for (uint i = 0; i < tokensB.length; i++) {
            if (tokensB[i] == address(0)) {
                nativeRequired += amountsB[i];
                lockedNative[escrowId] += amountsB[i];
            } else {
                uint256 fee = (amountsB[i] * depositFeeBps) / 10000;
                IERC20(tokensB[i]).safeTransferFrom(msg.sender, address(this), amountsB[i] + fee);
                lockedERC20[escrowId][tokensB[i]] += amountsB[i];
                // Send deposit fee
                if (fee > 0) {
                    IERC20(tokensB[i]).safeTransfer(feeRecipient, fee);
                    emit FeeCollected(escrowId, tokensB[i], fee);
                }
            }
        }

        if (nativeRequired > 0) {
            require(msg.value >= nativeRequired, "Insufficient ETH");
        }

        esc.status = EscrowStatus.ACTIVE;
        emit EscrowActivated(escrowId);
    }

    /// @notice PartyA confirms Fiat receipt → atomic settlement
    function confirmDelivery(uint256 escrowId) external nonReentrant {
        Escrow storage esc = escrows[escrowId];
        require(esc.partyA == msg.sender, "Not partyA");
        require(esc.status == EscrowStatus.ACTIVE, "Not active");

        esc.status = EscrowStatus.COMPLETED;
        _settle(escrowId, esc);
        emit EscrowCompleted(escrowId);
    }

    /// @notice Raise dispute with IPFS evidence hash
    function raiseDispute(uint256 escrowId, bytes32 evidenceHash) external {
        Escrow storage esc = escrows[escrowId];
        require(esc.partyA == msg.sender || esc.partyB == msg.sender, "Not party");
        require(esc.status == EscrowStatus.ACTIVE, "Not active");

        esc.status = EscrowStatus.DISPUTED;
        esc.disputeEvidenceHash = evidenceHash;
        emit EscrowDisputed(escrowId, msg.sender, evidenceHash);
    }

    /// @notice Arbitrator resolves dispute (2-of-3 multisig)
    function resolveByArbitrator(uint256 escrowId, address winner) external onlyRole(ARBITRATOR_ROLE) nonReentrant {
        Escrow storage esc = escrows[escrowId];
        require(esc.status == EscrowStatus.DISPUTED, "Not disputed");
        require(winner == esc.partyA || winner == esc.partyB, "Invalid winner");

        address loser = winner == esc.partyA ? esc.partyB : esc.partyA;
        esc.status = EscrowStatus.COMPLETED;

        // Winner gets escrow assets + loser's penalty
        // Loser gets their deposit back minus penalty
        _settleDispute(escrowId, esc, winner, loser);
        emit DisputeResolved(escrowId, winner);
        emit EscrowCompleted(escrowId);
    }

    /// @notice Both parties agree to cancel
    mapping(uint256 => mapping(address => bool)) public cancelApprovals;

    function mutualCancel(uint256 escrowId) external {
        Escrow storage esc = escrows[escrowId];
        require(esc.partyA == msg.sender || esc.partyB == msg.sender, "Not party");
        require(esc.status == EscrowStatus.ACTIVE || esc.status == EscrowStatus.PENDING, "Not cancellable");

        cancelApprovals[escrowId][msg.sender] = true;

        bool bothApproved = cancelApprovals[escrowId][esc.partyA] &&
                           cancelApprovals[escrowId][esc.partyB];

        if (bothApproved || esc.status == EscrowStatus.PENDING) {
            esc.status = EscrowStatus.CANCELLED;
            _refundBoth(escrowId, esc);
            emit EscrowCancelled(escrowId);
        }
    }

    /// @notice Keeper bot calls this when deadline is exceeded
    function emergencyExpire(uint256 escrowId) external onlyRole(KEEPER_ROLE) nonReentrant {
        Escrow storage esc = escrows[escrowId];
        require(block.timestamp > esc.deadline, "Not expired");
        require(esc.status == EscrowStatus.ACTIVE || esc.status == EscrowStatus.PENDING, "Not expirable");

        esc.status = EscrowStatus.CANCELLED;
        _refundBoth(escrowId, esc);
        emit EscrowCancelled(escrowId);
    }

    // === Internal settlement logic ===

    function _settle(uint256 escrowId, Escrow storage esc) internal {
        // Crypto→Fiat: send partyA's crypto to partyB, refund deposits
        // Collect platform fee first
        if (esc.feeToken != address(0) && esc.feeAmount > 0) {
            IERC20(esc.feeToken).safeTransfer(feeRecipient, esc.feeAmount);
            emit FeeCollected(escrowId, esc.feeToken, esc.feeAmount);
        }

        // Transfer partyA assets to partyB
        for (uint i = 0; i < esc.assetA.tokens.length; i++) {
            address token = esc.assetA.tokens[i];
            uint256 amt = esc.assetA.amounts[i];
            if (token == address(0)) {
                (bool ok,) = esc.partyB.call{value: amt}("");
                require(ok, "ETH transfer failed");
            } else {
                IERC20(token).safeTransfer(esc.partyB, amt);
            }
        }

        // Refund partyB deposit
        for (uint i = 0; i < esc.assetB.tokens.length; i++) {
            address token = esc.assetB.tokens[i];
            uint256 amt = lockedERC20[escrowId][token];
            if (token == address(0)) {
                uint256 native = lockedNative[escrowId];
                // subtract partyA portion
                (bool ok,) = esc.partyB.call{value: native > 0 ? native / 2 : 0}("");
                require(ok, "ETH refund failed");
            } else if (amt > 0) {
                lockedERC20[escrowId][token] = 0;
                IERC20(token).safeTransfer(esc.partyB, amt);
            }
        }

        // Refund partyA deposit
        _refundDeposit(escrowId, esc.partyA, esc.assetA);
    }

    function _settleDispute(uint256 escrowId, Escrow storage esc, address winner, address loser) internal {
        // Winner gets everything locked; loser's deposit partially goes to platform
        uint256 platformPenalty = (esc.penaltyAmount * penaltyFeeBps) / 10000;

        // Transfer partyA assets to winner
        for (uint i = 0; i < esc.assetA.tokens.length; i++) {
            address token = esc.assetA.tokens[i];
            uint256 amt = esc.assetA.amounts[i];
            if (token == address(0)) {
                (bool ok,) = winner.call{value: amt}("");
                require(ok, "ETH transfer failed");
            } else {
                IERC20(token).safeTransfer(winner, amt);
            }
        }

        // Loser's deposit: platform fee + remainder to winner
        if (esc.penaltyAmount > 0 && esc.assetA.tokens.length > 0) {
            address pToken = esc.assetA.tokens[0];
            if (pToken != address(0) && platformPenalty > 0) {
                IERC20(pToken).safeTransfer(feeRecipient, platformPenalty);
            }
        }
    }

    function _refundBoth(uint256 escrowId, Escrow storage esc) internal {
        _refundDeposit(escrowId, esc.partyA, esc.assetA);
        _refundDeposit(escrowId, esc.partyB, esc.assetB);
    }

    function _refundDeposit(uint256 escrowId, address to, AssetBundle storage bundle) internal {
        if (bundle.tokens.length == 0) return;
        for (uint i = 0; i < bundle.tokens.length; i++) {
            address token = bundle.tokens[i];
            if (token == address(0)) {
                uint256 native = lockedNative[escrowId];
                if (native > 0) {
                    lockedNative[escrowId] = 0;
                    (bool ok,) = to.call{value: native}("");
                    require(ok, "ETH refund failed");
                }
            } else {
                uint256 amt = lockedERC20[escrowId][token];
                if (amt > 0) {
                    lockedERC20[escrowId][token] = 0;
                    IERC20(token).safeTransfer(to, amt);
                }
            }
        }
    }

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    function getUserEscrows(address user) external view returns (uint256[] memory) {
        return userEscrows[user];
    }

    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeRecipient = newRecipient;
    }

    function setFeeBps(uint256 relay, uint256 deposit, uint256 penalty) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(relay <= 500 && deposit <= 200 && penalty <= 3000, "Fee too high");
        relayFeeBps = relay;
        depositFeeBps = deposit;
        penaltyFeeBps = penalty;
    }
}
