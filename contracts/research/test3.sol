
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract VulnerableMultiTxRewardPool {
    mapping(address => uint256) public deposited;
    mapping(address => bool) public bonusClaimed;
    mapping(address => uint256) public bonusClaims;
    mapping(address => uint256) public rewardBalance;

    function deposit() external payable {
        require(msg.value > 0, "Deposit must be positive");

        deposited[msg.sender] += msg.value;
    }

    function claimBonus() external {
        require(deposited[msg.sender] > 0, "Deposit first");

        require(
            !bonusClaimed[msg.sender],
            "Bonus already claimed"
        );

        bonusClaimed[msg.sender] = true;
        bonusClaims[msg.sender] += 1;
        rewardBalance[msg.sender] += 100;
    }

    function withdraw() external {
        uint256 amount = deposited[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        deposited[msg.sender] = 0;

        // VULNERABILITY:
        // This resets the lifetime claim protection.
        bonusClaimed[msg.sender] = false;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }
}
