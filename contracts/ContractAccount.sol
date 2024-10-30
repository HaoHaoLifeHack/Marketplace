// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/IContractAccount.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ContractAccount is IContractAccount {
    using ECDSA for bytes32;

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
        bytes32 msgHash,
        bytes memory signature,
        address to,
        bytes memory data,
        uint256 value
    ) external payable override returns (bool) {
        require(_isContract(msg.sender), "Only contract can execute");
        require(
            _recoverSigner(msgHash, signature) == owner,
            "Only owner can execute"
        );
        (bool success, ) = to.call{value: value}(data);
        require(success, "Execution failed");
        return success;
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
