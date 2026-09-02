// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IEscrowVault {
    function take(uint256 poolId, uint256 offerWanted) external payable;
    function cancel(uint256 poolId) external;
}

/**
 * @notice Malicious contract that attempts to re-enter take/cancel on ETH receive
 */
contract ReentrantTaker {
    IEscrowVault public vault;
    uint256 public targetPoolId;
    uint256 public targetAmount;
    bool public shouldReenter;

    constructor(address vault_) {
        vault = IEscrowVault(vault_);
    }

    function setTarget(uint256 poolId, uint256 amount) external {
        targetPoolId = poolId;
        targetAmount = amount;
    }

    function enableReentrancy() external {
        shouldReenter = true;
    }

    function attemptTake(uint256 poolId, uint256 amount) external payable {
        vault.take{value: msg.value}(poolId, amount);
    }

    function attemptCancel(uint256 poolId) external {
        vault.cancel(poolId);
    }

    receive() external payable {
        if (shouldReenter && targetPoolId != 0) {
            // Try to re-enter
            shouldReenter = false; // Prevent infinite loop
            vault.take(targetPoolId, targetAmount);
        }
    }
}
