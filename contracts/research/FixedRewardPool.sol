
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract FixedRewardPool {
    mapping(address => bool) public deposited;
    mapping(address => bool) public bonusClaimed;
    mapping(address => uint256) public bonusClaims;
    mapping(address => uint256) public rewardBalance;

    function deposit() external {
        deposited[msg.sender] = true;
    }

    function claimBonus() external {
        require(deposited[msg.sender], "Deposit required");
        require(!bonusClaimed[msg.sender], "Bonus already claimed");

        bonusClaimed[msg.sender] = true;
        bonusClaims[msg.sender] += 1;
        rewardBalance[msg.sender] += 100;
    }

    function withdraw() external {
        require(deposited[msg.sender], "No active deposit");
        deposited[msg.sender] = false;

        // FIX: bonus eligibility remains consumed.
    }
}
