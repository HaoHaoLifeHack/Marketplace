// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/IContractAccount.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ContractAccount is IContractAccount {
    using ECDSA for bytes32;

    address public override owner;
    mapping(address => IERC20) public votingTokens; // DAO => VotingToken
    mapping(address => IERC1155) public votingTokens1155; // DAO => VotingToken1155

    constructor() {
        owner = msg.sender;
    }

    function addVotingToken(
        address daoAddress,
        address tokenAddress,
        bool isERC1155
    ) external {
        require(msg.sender == owner, "Only owner can add");

        if (isERC1155) {
            votingTokens1155[daoAddress] = IERC1155(tokenAddress);
        } else {
            votingTokens[daoAddress] = IERC20(tokenAddress);
        }
    }

    function approveVotingToken(
        address daoAddress,
        uint256 amount,
        uint256 tokenId
    ) external {
        require(msg.sender == owner, "Only owner can approve");
        if (tokenId == 0) {
            // ERC20 case
            IERC20 token = votingTokens[daoAddress];
            require(
                address(token) != address(0),
                "ERC20 token not set for DAO"
            );
            token.approve(daoAddress, amount);
        } else {
            // ERC1155 case
            IERC1155 token1155 = votingTokens1155[daoAddress];
            require(
                address(token1155) != address(0),
                "ERC1155 token not set for DAO"
            );
            token1155.setApprovalForAll(daoAddress, true);
        }
    }

    function execute(
        bytes32 msgHash,
        bytes memory signature,
        address to,
        bytes memory data
    ) external payable override {
        require(
            _recoverSigner(msgHash, signature) == owner,
            "Only owner can execute"
        );
        (bool success, ) = to.call{value: msg.value}(data);
        require(success, "Execution failed");
    }

    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account) // Get the code size at the address
        }
        return size > 0; // If size > 0, it's a contract
    }

    function _recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (address) {
        return _getEthSignedMessageHash(hash).recover(signature);
    }

    function _getEthSignedMessageHash(
        bytes32 _messageHash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _messageHash
                )
            );
    }
}
