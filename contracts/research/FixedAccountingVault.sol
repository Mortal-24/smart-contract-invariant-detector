// SPDX-License-Identifier : MIT
pragma solidity ^0.8.34;

contract FixedAccountingVault
{
    mapping(address=>uint256)public depositedTotal;
    mapping(address=>uint256)public withdrawnTotal;

    function deposit(uint256 amount) external
    {
        require(amount>0,"Amount must be in postive");
        depositedTotal[msg.sender]+=amount;
    }
    function withdraw(uint256 amount) external{
        require(amount>0,"AMOUNT MUST BE  in postive");
        uint256 available = depositedTotal[msg.sender] - withdrawnTotal[msg.sender];
        require(amount<=available,"not enough baqlancc");
        withdrawnTotal[msg.sender]+=amount;

        }
}