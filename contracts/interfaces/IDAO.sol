// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IDAO {
    struct Proposal {
        uint256 id;
        address executeAddr;
        uint256 amount;
        bytes data;
        string proposalDetail;
    }

    // the total amount of vote for the proposal to pass
    function threshold() external view returns (uint256);

    // submit a proposal, wait for others to vote
    function submitProposal(Proposal calldata _proposal) external;

    // vote for a specific proposal
    function vote(uint256 proposalId, uint256 amount) external;
}
