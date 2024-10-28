// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/IContractAccount.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ContractAccount is IContractAccount {
    address public override owner;
    mapping(address => IERC20) public votingTokens; // DAO => VotingToken

    constructor() {
        owner = msg.sender;
    }

    function addVotingToken(address daoAddress, IERC20 token) external {
        require(msg.sender == owner, "Only owner can add");
        votingTokens[daoAddress] = token;
    }

    function approveVotingToken(address daoAddress, uint256 amount) external {
        require(msg.sender == owner, "Only owner can approve");
        IERC20 token = votingTokens[daoAddress];
        token.approve(daoAddress, amount);
    }

    function execute(
        address seller,
        address to,
        bytes memory data,
        uint256 value
    ) external payable override returns (bool) {
        require(seller == owner, "Only owner can execute");
        (bool success, ) = to.call{value: value}(data);
        require(success, "Execution failed");
        return success;
    }
}
