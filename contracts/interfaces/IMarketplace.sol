// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IMarketplace {
    struct Item {
        address asset;
        uint256 amountOrTokenId;
    }
    struct ItemV2 {
        address asset;
        uint256[] ids;
        uint256[] amountOrTokenIds;
    }
    struct Trigger {
        address executeAddress;
        bytes data;
    }
    struct OrderBasic {
        uint256 eid;
        address seller;
        address buyer;
        ItemV2 toSell;
        ItemV2 toFulfill;
        bool fulfilled;
        uint256 deadline;
    }
    struct Order {
        uint256 eid;
        address seller;
        address buyer;
        Trigger toSell;
        ItemV2 toFulfill;
        bool fulfilled;
        uint256 deadline;
    }
}
