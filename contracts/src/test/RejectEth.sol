// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @notice Contract that rejects ETH payments
 */
contract RejectEth {
    receive() external payable {
        revert("RejectEth: no thanks");
    }
}
