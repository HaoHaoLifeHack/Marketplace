// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/IDAO.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/IContractAccount.sol";

contract SimpleDAO is IDAO {
    address public marketplaceContract;
    IERC20 public votingToken;
    mapping(uint256 => Proposal) public proposals; // proposalId => proposal
    uint256 public totalSupply;
    mapping(uint256 => uint256) public votes; // proposalId => votes

    event Vote(
        address indexed voter,
        uint256 indexed proposalId,
        uint256 indexed amount
    );

    constructor(
        IERC20 _votingToken,
        uint256 _totalSupply,
        address _marketplaceContract
    ) {
        votingToken = _votingToken;
        totalSupply = _totalSupply;
        marketplaceContract = _marketplaceContract;
    }

    function threshold() public view override returns (uint256) {
        return totalSupply / 2;
    }

    function submitProposal(Proposal calldata _proposal) external override {
        proposals[_proposal.id] = _proposal;
    }

    // TODO: Check the Only modifier
    function vote(uint256 proposalId, uint256 amount) external override {
        require(
            votes[proposalId] + amount <= threshold(),
            "Exceeds voting threshold"
        );
        votingToken.transferFrom(msg.sender, address(this), amount);
        votes[proposalId] += amount;
        emit Vote(msg.sender, proposalId, amount);
    }

    modifier onlyMarketplace() {
        require(
            msg.sender == marketplaceContract,
            "Only Marketplace can call this"
        );
        _;
    }
}
