// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.24;

interface IContractAccount {
    function owner() external view returns (address);

    function execute(
        bytes32 msgHash,
        bytes memory signature,
        address to,
        bytes memory data,
        uint256 value
    ) external payable returns (bool);
}
