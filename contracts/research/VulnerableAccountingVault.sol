// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract VulnerableAccountingVault{
    mapping(address=>uint256) public depositedTotal;
    mapping(address=>uint256) public withdrawnTotal;

    function deposit(uint256 amount)external{
        require(amount>0,"Amount must be positive");
        depositedTotal[msg.sender]+=amount;
    }
    function withdraw(uint256 amount) external {
        require(amount>0,"Amount must ne postive");
        uint256 available = depositedTotal[msg.sender] - withdrawnTotal[msg.sender];
        require(amount<=available,"Insufficent balance");

    }
}