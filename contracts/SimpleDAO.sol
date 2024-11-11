// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/IDAO.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/IContractAccount.sol";

contract SimpleDAO is IDAO {
  IERC20 public votingToken;
  mapping(uint256 => Proposal) public proposals; // proposalId => proposal
  uint256 public totalSupply;
  mapping(uint256 => uint256) public votes; // proposalId => votes

  event Vote(address indexed voter, uint256 indexed proposalId, uint256 amount, uint256 indexed timestamp);

  constructor(IERC20 _votingToken, uint256 _totalSupply) {
    votingToken = _votingToken;
    totalSupply = _totalSupply;
  }

  function threshold() public view override returns (uint256) {
    return totalSupply / 2;
  }

  function submitProposal(Proposal calldata _proposal) external override {
    proposals[_proposal.id] = _proposal;
  }

  function vote(uint256 proposalId, uint256 amount) external override {
    votingToken.transferFrom(msg.sender, address(this), amount);
    votes[proposalId] += amount;
    emit Vote(msg.sender, proposalId, amount, block.timestamp);
    if (votes[proposalId] >= threshold()) _executeProposal(proposalId);
  }

  function _executeProposal(uint256 proposalId) internal {
    Proposal storage proposal = proposals[proposalId];
    require(proposal.executed == false, "Proposal already executed");
    proposal.executed = true;
    (bool success, ) = proposal.executeAddr.call(proposal.data);
    require(success, "Proposal execution failed");
  }
}
