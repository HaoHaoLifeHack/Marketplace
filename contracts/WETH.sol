// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20 {
  constructor() ERC20("Wrapped Ether", "WETH") {}

  // Receive Ether and mint WETH
  function deposit() external payable {
    _mint(msg.sender, msg.value);
  }

  // Withdraw WETH and receive Ether
  function withdraw(uint256 amount) external {
    _burn(msg.sender, amount);
    (bool success, ) = msg.sender.call{ value: amount }("");
    require(success, "Transfer failed.");
  }
}
