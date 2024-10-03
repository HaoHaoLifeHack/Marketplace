// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./OracleHandler.sol"; // Import Oracle handler for fetching prices
import "./interfaces/IMarketplace.sol";
import "hardhat/console.sol";

contract Marketplace is IMarketplace {
    uint256 private _orderCounter; //For eid counter
    mapping(uint256 => Order) public orders; // Map eid to Order
    mapping(address => uint256[]) public sellerOrders; // Track orders by seller
    address public platformFeeRecipient;
    uint256 public platformFeePercentage = 5; // 5% platform fee
    OracleHandler public oracleHandler;

    event OrderCreated(
        uint256 eid,
        address seller,
        Item toSell,
        Item toFulfill
    );
    event OrderCancelled(uint256 eid);
    event OrderFulfilled(uint256 eid, address buyer, uint256 feeInETH);

    constructor(OracleHandler _oracleHandler) {
        oracleHandler = _oracleHandler;
        _orderCounter = 0;
    }

    // Seller creates a new order to list an item for sale
    function list(Order memory order) external override {
        require(order.toSell.asset != address(0), "Invalid sell asset");
        require(order.toFulfill.asset != address(0), "Invalid fulfill asset");
        uint256 eid = ++_orderCounter;
        orders[eid] = Order({
            eid: eid,
            seller: msg.sender,
            buyer: address(0),
            toSell: order.toSell,
            toFulfill: order.toFulfill,
            fulfilled: false,
            deadline: order.deadline
        });

        emit OrderCreated(eid, msg.sender, order.toSell, order.toFulfill);
    }

    // Seller cancels their own order
    function cancel(uint256 eid) external override {
        Order storage order = orders[eid];
        require(msg.sender == order.seller, "Only seller can cancel");
        require(!order.fulfilled, "Order already fulfilled");
        delete orders[eid];
        emit OrderCancelled(eid);
    }

    // Buyer fulfills a seller's order
    function fulfill(uint256 eid) external payable override {
        Order storage order = orders[eid];
        require(!order.fulfilled, "Order already fulfilled");
        require(block.timestamp <= order.deadline, "Order expired");
        uint256 platformFee;
        // Transfer assets from buyer to seller
        if (_isERC721(order.toFulfill.asset)) {
            // Handle ERC721 asset transfer from buyer to seller
            IERC721(order.toFulfill.asset).safeTransferFrom(
                msg.sender,
                order.seller,
                order.toFulfill.amountOrTokenId
            );

            // Fetch price for ERC721 from Oracle (or mock implementation)
            uint256 priceInETH = oracleHandler.getLatestPriceInETH(
                order.toFulfill.asset
            );
            platformFee = (priceInETH * platformFeePercentage) / 100;
            require(
                msg.value >= platformFee,
                "Insufficient ETH for platform fee"
            );
        } else {
            // Handle ERC20 asset transfer from buyer to seller
            IERC20(order.toFulfill.asset).transferFrom(
                msg.sender,
                order.seller,
                order.toFulfill.amountOrTokenId
            );

            // Fetch price for ERC20 from Oracle
            uint256 priceInETH = oracleHandler.getLatestPriceInETH(
                order.toFulfill.asset
            );
            platformFee = (priceInETH * platformFeePercentage) / 100;
            require(
                msg.value >= platformFee,
                "Insufficient ETH for platform fee"
            );
        }

        // Transfer item being sold to buyer
        if (_isERC721(order.toSell.asset)) {
            IERC721(order.toSell.asset).safeTransferFrom(
                order.seller,
                msg.sender,
                order.toSell.amountOrTokenId
            );
        } else {
            IERC20(order.toSell.asset).transferFrom(
                order.seller,
                msg.sender,
                order.toSell.amountOrTokenId
            );
        }

        order.fulfilled = true;
        emit OrderFulfilled(eid, msg.sender, platformFee);
    }

    // Helper function to check if an asset is ERC721
    function _isERC721(address asset) public view returns (bool) {
        bytes memory data = abi.encodeWithSelector(
            IERC165.supportsInterface.selector,
            type(IERC721).interfaceId
        );
        (bool success, bytes memory result) = asset.staticcall(data);
        //console.log("success" + success);

        if (!success) return false;
        // Check if the call succeeded and the result is true
        bool isSupport = abi.decode(result, (bool));
        return isSupport;
    }

    // View all active orders
    function viewOrders() external view returns (Order[] memory) {
        uint256 totalOrders = _orderCounter;
        Order[] memory activeOrders = new Order[](totalOrders);
        for (uint256 i = 0; i < totalOrders; i++) {
            if (!orders[i].fulfilled) {
                activeOrders[i] = orders[i];
            }
        }
        return activeOrders;
    }
}
