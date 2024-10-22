// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./OracleHandler.sol"; // Import Oracle handler for fetching prices
import "./interfaces/IMarketplace.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Marketplace is IMarketplace {
    using ECDSA for bytes32;
    using MerkleProof for bytes32[];

    mapping(address => bytes32) public merkleRoots; //Seperate by the seller
    address owner;
    uint256 private _orderCounter; //For eid counter
    mapping(uint256 => Order) public orders; // Map eid to Order
    mapping(bytes32 => bool) public cancelOrders; //Map orderHash to bool
    OracleHandler public oracleHandler;
    uint256 public constant PLATFORM_FEE_BPS = 5; // 5.00% in basis points
    uint256 public constant FACTOR = 100; // Precision factor to simulate decimals
    uint256 private constant LIMIT = 25;

    event OrderCancelled(bytes32 indexed orderHash);
    event OrderFulfilled(
        uint256 indexed eid,
        address indexed buyer,
        uint256 indexed indexedfeeInETH
    );
    event Withdraw(address indexed receiver, uint256 amount);
    event RecoveredSeller(string message, address indexed recoveredSeller);

    constructor(OracleHandler _oracleHandler) {
        owner = msg.sender;
        oracleHandler = _oracleHandler;
    }

    // Seller cancels their own order
    function cancelOrder(
        Order memory order,
        bytes memory sellerSignature
    ) external returns (bool) {
        require(!order.fulfilled, "Order already fulfilled");
        bytes32 orderHash = getOrderHash(order);
        address recoveredSeller = recoverSigner(orderHash, sellerSignature);
        require(recoveredSeller == order.seller, "Only seller can cancel");
        cancelOrders[orderHash] = true;

        emit OrderCancelled(orderHash);
        return cancelOrders[orderHash] == true;
    }

    // Seller cancels their own order
    function cancelMerkleOrder(
        Order memory order,
        bytes memory sellerSignature,
        bytes32[] calldata merkleProof
    ) external {
        // TODO: To test which require is the most cheap way
        require(!order.fulfilled, "Order already fulfilled");
        bytes32 orderHash = getOrderHash(order);
        require(
            merkleRoots[order.seller] ==
                keccak256(abi.encodePacked(merkleProof)),
            "Invalid merkle proof"
        );
        address recoveredSeller = recoverSigner(orderHash, sellerSignature);
        require(recoveredSeller == order.seller, "Only seller can cancel");
        cancelOrders[orderHash] = true;

        emit OrderCancelled(orderHash);
    }

    // Buyer brings the signed order
    function fulfillOffchainOrder(
        Order memory order,
        bytes memory sellerSignature
    ) external payable {
        require(!order.fulfilled, "Order already fulfilled");
        require(block.timestamp <= order.deadline, "Order expired");

        bytes32 orderHash = getOrderHash(order);
        require(cancelOrders[orderHash] == false, "Order not cancelled");

        address recoveredSeller = recoverSigner(orderHash, sellerSignature);

        emit RecoveredSeller("RecoverySeller: ", recoveredSeller);

        // Ensure the recovered address matches the seller in the order
        require(recoveredSeller == order.seller, "Invalid signature");

        // Platform fee
        uint256 platformFee;

        // First fetch the price in ETH to calculate platform fee
        uint256 priceInETH = oracleHandler.getLatestPriceInETH(
            order.toFulfill.asset
        );

        // Fee calculation
        platformFee = (priceInETH * PLATFORM_FEE_BPS * FACTOR) / (100 * FACTOR);
        require(msg.value >= platformFee, "Insufficient ETH for platform fee");

        // TODO: Trigger order to execute voting by ContractAccount

        // Handle asset transfers
        _handleAssetTransfer(order.toFulfill, order.buyer, order.seller);

        // Emit order fulfillment event
        emit OrderFulfilled(_orderCounter++, msg.sender, 0); // Example fee set to 0 for simplicity
    }

    // Generates the order hash
    function getOrderHash(Order memory order) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    order.eid,
                    order.seller,
                    order.toSell.daoAddress,
                    order.toSell.data,
                    order.toFulfill.asset,
                    order.toFulfill.amountOrTokenId,
                    order.deadline,
                    order.fulfilled
                )
            );
    }

    // Verifies the signature using ecrecover
    function recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) public pure returns (address) {
        return getEthSignedMessageHash(hash).recover(signature);
    }

    function getEthSignedMessageHash(
        bytes32 _messageHash
    ) public pure returns (bytes32) {
        /*
        Signature is produced by signing a keccak256 hash with the following format:
        "\x19Ethereum Signed Message\n" + len(msg) + msg
        */
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _messageHash
                )
            );
    }

    // Verify merkle proof
    function verifyMerkleProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) external pure returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }

    //function verifyOrderSignature(address seller, bytes32 orderHash, bytes memory sellerSignature)

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
        uint256 totalOrders = _orderCounter;

        // Create an array for the active orders with size up to the limit
        Order[] memory activeOrders = new Order[](LIMIT);
        uint256 count = 0;

        // Loop through the orders starting from the offset
        for (uint256 i = offset; i <= totalOrders && count < LIMIT; i++) {
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

    function test(uint256 id, uint256 amount) external pure returns (uint256) {
        return id;
    }

    receive() external payable {}
}
