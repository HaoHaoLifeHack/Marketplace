// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./OracleHandler.sol"; // Import Oracle handler for fetching prices
import "./interfaces/IMarketplace.sol";
import "hardhat/console.sol";

contract Marketplace is IMarketplace {
    address owner;
    uint256 private _orderCounter; //For eid counter
    mapping(uint256 => Order) public orders; // Map eid to Order
    OracleHandler public oracleHandler;
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5.00% in basis points
    uint256 public constant PRECISION = 1e7; // Precision factor to simulate decimals

    event OrderCreated(
        uint256 eid,
        address seller,
        Item toSell,
        Item toFulfill
    );
    event OrderCancelled(uint256 eid);
    event OrderFulfilled(uint256 eid, address buyer, uint256 feeInETH);
    event Withdraw(address indexed receiver, uint256 amount);

    constructor(OracleHandler _oracleHandler) {
        owner = msg.sender;
        oracleHandler = _oracleHandler;
    }

    // Seller creates a new order to list an item for sale
    function list(
        Item memory toSell,
        Item memory toFulfill,
        uint256 deadline
    ) external override {
        require(toSell.asset != address(0), "Invalid sell asset");
        require(toFulfill.asset != address(0), "Invalid fulfill asset");
        uint256 eid = ++_orderCounter;
        orders[eid] = Order({
            eid: eid,
            seller: msg.sender,
            buyer: address(0),
            toSell: toSell,
            toFulfill: toFulfill,
            fulfilled: false,
            deadline: deadline
        });

        emit OrderCreated(eid, msg.sender, toSell, toFulfill);
    }

    // Seller cancels their own order
    function cancel(uint256 eid) external override {
        Order storage order = orders[eid];
        require(msg.sender == order.seller, "Only seller can cancel");
        require(!order.fulfilled, "Order already fulfilled");
        delete orders[eid];
        emit OrderCancelled(eid);
    }

    function fulfill(uint256 eid) external payable override {
        Order memory order = orders[eid];
        require(!order.fulfilled, "Order already fulfilled");
        require(block.timestamp <= order.deadline, "Order expired");

        uint256 platformFee;

        // First fetch the price in ETH to calculate platform fee
        uint256 priceInETH = oracleHandler.getLatestPriceInETH(
            order.toFulfill.asset
        );
        // Fee calculation
        platformFee = (priceInETH * PLATFORM_FEE_BPS) / PRECISION;
        require(msg.value >= platformFee, "Insufficient ETH for platform fee");

        // Handle asset transfer from seller to buyer
        _handleAssetTransfer(order.toSell, order.seller, msg.sender);

        // Handle payment transfer from buyer to seller
        _handleAssetTransfer(order.toFulfill, msg.sender, order.seller);

        // Mark the order as fulfilled only after both transfers succeed
        orders[eid].fulfilled = true;

        emit OrderFulfilled(eid, msg.sender, platformFee);
    }

    // Helper function to handle asset transfer
    function _handleAssetTransfer(
        Item memory item,
        address from,
        address to
    ) internal {
        if (_isERC721(item.asset)) {
            IERC721(item.asset).safeTransferFrom(
                from,
                to,
                item.amountOrTokenId
            );
        } else {
            IERC20(item.asset).transferFrom(from, to, item.amountOrTokenId);
        }
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

    function viewActiveOrders(
        uint256 offset
    ) external view returns (Order[] memory) {
        uint256 limit = 25;
        uint256 totalOrders = _orderCounter;

        // Create an array for the active orders with size up to the limit
        Order[] memory activeOrders = new Order[](limit);
        uint256 count = 0;

        // Loop through the orders starting from the offset
        for (uint256 i = offset; i <= totalOrders && count < limit; i++) {
            if (!orders[i].fulfilled) {
                activeOrders[count] = orders[i];
                count++;
            }
        }
        return activeOrders;
    }

    function withdraw() external onlyOwner {
        require(address(this).balance > 0, "No balance to withdraw");
        payable(owner).transfer(address(this).balance);
        emit Withdraw(owner, address(this).balance);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    receive() external payable {}
}
