// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// Start with this template
// this template could be modified in any kind of form

interface IMarketplace {
    // the structure of this could be changed
    struct Item {
        address asset;
        uint256 amountOrTokenId;
    }

    struct Order {
        uint256 eid;
        address seller;
        address buyer;
        Item toSell;
        Item toFulfill;
        bool fulfilled;
        uint256 deadline;
    }

    function list(Order memory order) external;

    function cancel(uint256 eid) external;

    function fulfill(uint256 eid) external payable;
}
