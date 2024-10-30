// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/IDAO.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/IContractAccount.sol";

contract SimpleDAOV2 is IDAO {
    IERC1155 public votingToken;
    uint256 public votingTokenId; // Token ID used for voting
    mapping(uint256 => Proposal) public proposals; // proposalId => proposal
    uint256 public totalSupply;
    mapping(uint256 => uint256) public votes; // proposalId => votes

    event Vote(
        address indexed voter,
        uint256 indexed proposalId,
        uint256 indexed amount
    );

    constructor(
        IERC1155 _votingToken,
        uint256 _votingTokenId,
        uint256 _totalSupply
    ) {
        votingToken = _votingToken;
        votingTokenId = _votingTokenId;
        totalSupply = _totalSupply;
    }

    function threshold() public view override returns (uint256) {
        return totalSupply / 2;
    }

    function submitProposal(Proposal calldata _proposal) external override {
        proposals[_proposal.id] = _proposal;
    }

    function vote(uint256 proposalId, uint256 amount) external override {
        require(
            votes[proposalId] + amount <= threshold(),
            "Exceeds voting threshold"
        );

        // Use ERC1155's safeTransferFrom for token transfer
        votingToken.safeTransferFrom(
            msg.sender,
            address(this),
            votingTokenId,
            amount,
            ""
        );

        votes[proposalId] += amount;
        emit Vote(msg.sender, proposalId, amount);
    }
}
