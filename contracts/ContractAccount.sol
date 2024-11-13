// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/IContractAccount.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ContractAccount is IContractAccount, ERC1155Holder {
  using ECDSA for bytes32;

  address public override owner;
  mapping(address => IERC20) public votingTokens; // DAO => VotingToken
  mapping(address => IERC1155) public votingTokens1155; // DAO => VotingToken1155

  constructor() {
    owner = msg.sender;
  }

  function addVotingToken(address daoAddress, address tokenAddress) external {
    require(msg.sender == owner, "Only owner can add");

    if (_isERC1155(tokenAddress)) {
      votingTokens1155[daoAddress] = IERC1155(tokenAddress);
    } else {
      votingTokens[daoAddress] = IERC20(tokenAddress);
    }
  }

  function approveVotingToken(address daoAddress, uint256 amount, address tokenAddress) external {
    require(msg.sender == owner, "Only owner can approve");
    if (_isERC1155(tokenAddress)) {
      IERC1155 token1155 = votingTokens1155[daoAddress];
      require(address(token1155) != address(0), "ERC1155 token not set for DAO");
      token1155.setApprovalForAll(daoAddress, true);
    } else {
      IERC20 token = votingTokens[daoAddress];
      require(address(token) != address(0), "ERC20 token not set for DAO");
      token.approve(daoAddress, amount);
    }
  }

  function execute(bytes32 msgHash, bytes memory signature, address to, bytes memory data) external payable override {
    require(_recoverSigner(msgHash, signature) == owner, "Only owner can execute");
    (bool success, ) = to.call{ value: msg.value }(data);
    require(success, "Execution failed");
  }

  function _recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
    return _getEthSignedMessageHash(hash).recover(signature);
  }

  function _getEthSignedMessageHash(bytes32 _messageHash) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
  }

  function _isERC1155(address asset) internal view returns (bool) {
    return _supportsInterface(asset, type(IERC1155).interfaceId);
  }

  function _supportsInterface(address asset, bytes4 interfaceId) internal view returns (bool) {
    bytes memory data = abi.encodeWithSelector(IERC165.supportsInterface.selector, interfaceId);
    (bool success, bytes memory result) = asset.staticcall(data);

    if (!success) return false;
    return abi.decode(result, (bool));
  }
}
