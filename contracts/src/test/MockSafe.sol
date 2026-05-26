// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal Gnosis-Safe-like stub for unit-testing modules.
///      Faithfully models the two behaviours the ExpiryRefundModule relies on:
///      (1) only enabled modules may call execTransactionFromModule,
///      (2) execTransactionFromModule performs a CALL from the Safe.
///      `exec` simulates an owner-approved (2/3) Safe transaction.
contract MockSafe {
    mapping(address => bool) public modules;

    function enableModule(address module) external {
        modules[module] = true;
    }

    /// @notice Simulate an owner-approved Safe transaction (e.g. the configure() setup call).
    function exec(address to, bytes calldata data) external payable returns (bytes memory) {
        (bool ok, bytes memory ret) = to.call{value: msg.value}(data);
        require(ok, "MockSafe: exec failed");
        return ret;
    }

    /// @notice Safe module entrypoint. Only enabled modules may call.
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 /* operation */
    ) external returns (bool success) {
        require(modules[msg.sender], "GS104"); // not an enabled module
        (success, ) = to.call{value: value}(data);
        require(success, "MockSafe: module exec failed");
    }

    receive() external payable {}
}
