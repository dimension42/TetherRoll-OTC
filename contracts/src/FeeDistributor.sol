// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Collects and distributes platform fees. Owned by 3-of-5 multisig.
contract FeeDistributor is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    event FeeReceived(address indexed token, uint256 amount);
    event FeeWithdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address multisig) {
        _grantRole(DEFAULT_ADMIN_ROLE, multisig);
        _grantRole(WITHDRAWER_ROLE, multisig);
    }

    receive() external payable {
        emit FeeReceived(address(0), msg.value);
    }

    function withdrawETH(address payable to, uint256 amount) external onlyRole(WITHDRAWER_ROLE) {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool ok,) = to.call{value: amount}("");
        require(ok, "Transfer failed");
        emit FeeWithdrawn(address(0), to, amount);
    }

    function withdrawERC20(address token, address to, uint256 amount) external onlyRole(WITHDRAWER_ROLE) {
        IERC20(token).safeTransfer(to, amount);
        emit FeeWithdrawn(token, to, amount);
    }

    function getBalance(address token) external view returns (uint256) {
        if (token == address(0)) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }
}
