// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal subset of the Gnosis Safe module interface used here.
interface ISafeModuleExec {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation // 0 = Call
    ) external returns (bool success);
}

/// @title ExpiryRefundModule (Mode 1 — D12)
/// @notice Per-Safe expiry refund module for the 2-of-3 joint escrow.
///         After `deadline`, ANYONE (keeper, party A, etc.) may trigger a refund
///         of the configured asset's full balance to the FIXED `refundTo` (party A,
///         the depositor). The module is constrained so it can do nothing else:
///         it can only move the one configured asset, only to the fixed destination,
///         only after the deadline, only once. The platform key cannot use it to
///         redirect funds — there is no destination/asset setter after configure().
/// @dev Enable this module on the Safe, then have the Safe call `configure` exactly once
///      (as part of the owner-approved setup transaction).
contract ExpiryRefundModule {
    struct Config {
        address refundTo;  // fixed destination (party A) — immutable after configure
        address asset;     // ERC-20 token, or address(0) for native ETH
        uint64  deadline;   // unix seconds; refundable only after this
        bool    configured;
        bool    done;       // one-shot
    }

    /// @notice safe address => configuration
    mapping(address => Config) private _configs;

    event Configured(address indexed safe, address indexed refundTo, address asset, uint64 deadline);
    event Refunded(address indexed safe, address indexed refundTo, address asset, uint256 amount);

    error AlreadyConfigured();
    error NotConfigured();
    error ZeroRefundTo();
    error DeadlineNotFuture();
    error NotExpired();
    error AlreadyDone();
    error NothingToRefund();
    error ExecFailed();

    /// @notice Called by the Safe itself (msg.sender == Safe) exactly once.
    /// @param refundTo party A (depositor) — where funds return on expiry.
    /// @param asset    ERC-20 address, or address(0) for native ETH.
    /// @param deadline unix seconds; must be in the future.
    function configure(address refundTo, address asset, uint64 deadline) external {
        Config storage c = _configs[msg.sender];
        if (c.configured) revert AlreadyConfigured();
        if (refundTo == address(0)) revert ZeroRefundTo();
        if (deadline <= block.timestamp) revert DeadlineNotFuture();

        c.refundTo = refundTo;
        c.asset = asset;
        c.deadline = deadline;
        c.configured = true;

        emit Configured(msg.sender, refundTo, asset, deadline);
    }

    /// @notice Permissionless: after the deadline, refund the full balance to party A.
    /// @dev State is updated before the external call (checks-effects-interactions);
    ///      a failed transfer reverts the whole tx (so `done` is not left set).
    function refund(address safe) external {
        Config storage c = _configs[safe];
        if (!c.configured) revert NotConfigured();
        if (block.timestamp <= c.deadline) revert NotExpired();
        if (c.done) revert AlreadyDone();
        c.done = true;

        uint256 amount;
        bool ok;

        if (c.asset == address(0)) {
            amount = safe.balance;
            if (amount == 0) revert NothingToRefund();
            ok = ISafeModuleExec(safe).execTransactionFromModule(c.refundTo, amount, "", 0);
        } else {
            amount = IERC20(c.asset).balanceOf(safe);
            if (amount == 0) revert NothingToRefund();
            bytes memory data = abi.encodeWithSelector(IERC20.transfer.selector, c.refundTo, amount);
            ok = ISafeModuleExec(safe).execTransactionFromModule(c.asset, 0, data, 0);
        }

        if (!ok) revert ExecFailed();
        emit Refunded(safe, c.refundTo, c.asset, amount);
    }

    function getConfig(address safe) external view returns (Config memory) {
        return _configs[safe];
    }
}
