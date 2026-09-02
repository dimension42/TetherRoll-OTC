// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Mock token that burns 1% on every transfer (simulates fee-on-transfer tokens)
 */
contract FeeOnTransferMock is ERC20 {
    uint8 private _decimals;
    uint256 public constant FEE_BPS = 100; // 1%

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0)) {
            // Minting or burning - no fee
            super._update(from, to, amount);
        } else {
            // Transfer - apply 1% fee
            uint256 fee = (amount * FEE_BPS) / 10000;
            uint256 amountAfterFee = amount - fee;
            super._update(from, to, amountAfterFee);
            // Burn the fee
            if (fee > 0) {
                super._update(from, address(0), fee);
            }
        }
    }
}
