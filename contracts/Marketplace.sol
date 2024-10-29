// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./OracleHandler.sol"; // Import Oracle handler for fetching prices
import "./interfaces/IMarketplace.sol";
import "./interfaces/IContractAccount.sol";
import "./interfaces/IDAO.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Marketplace is IMarketplace {
    using ECDSA for bytes32;
    using MerkleProof for bytes32[];

    mapping(address => bytes32) public merkleRoots; //Seperate by the seller
    address owner;
    uint256 private _orderCounter; //For eid counter
    mapping(bytes32 => bool) public canceledOrders; //Map orderHash to bool
    mapping(bytes32 => bool) public fulfilledOrders; //Map orderHash to bool
    OracleHandler public oracleHandler;

    uint256 public constant PLATFORM_FEE_BPS = 5; // 5.00% in basis points
    uint256 public constant FACTOR = 100; // Precision factor to simulate decimals
    uint256 private constant LIMIT = 25;

    event OrderCancelled(bytes32 indexed orderHash);
    event AllOrdersCancelled(string indexed message);
    event OrderFulfilled(
        bytes32 indexed orderHash,
        address indexed buyer,
        uint256 indexed feeInETH
    );
    event Withdraw(address indexed receiver, uint256 amount);
    event RecoveredSeller(string message, address indexed recoveredSeller);
    event TestResult(string indexed title, bool indexed result);

    constructor(OracleHandler _oracleHandler) {
        owner = msg.sender;
        oracleHandler = _oracleHandler;
    }

    // Seller cancels their own order
    function cancelOrder(
        Order memory order,
        bytes memory sellerSignature
    ) external {
        require(!order.fulfilled, "Order already fulfilled");
        bytes32 orderHash = getOrderHash(order);
        address recoveredSeller = recoverSigner(orderHash, sellerSignature);
        require(recoveredSeller == order.seller, "Only seller can cancel");
        canceledOrders[orderHash] = true;

        emit OrderCancelled(orderHash);
    }

    // Seller cancels their own order
    function cancelAllOrders() external {
        require(merkleRoots[msg.sender] != 0, "The Seller has no order yet");
        updateMerkleRoot("0x0");
        emit AllOrdersCancelled("All orders cancelled");
    }

    // Buyer brings the signed order
    function fulfillOffchainOrder(
        Order memory order,
        bytes memory sellerSignature,
        address contractAccountAddress
    ) public payable {
        require(block.timestamp <= order.deadline, "Order expired");

        bytes32 orderHash = getOrderHash(order);
        require(!fulfilledOrders[orderHash], "Order already fulfilled");
        require(!canceledOrders[orderHash], "Order not cancelled");

        address recoveredSeller = recoverSigner(orderHash, sellerSignature);

        // Ensure the recovered address matches the seller in the order
        require(recoveredSeller == order.seller, "Invalid signature");

        // Ensure the recovered address owned the contract account
        IContractAccount contractAccount = IContractAccount(
            contractAccountAddress
        );
        require(
            contractAccount.owner() == recoveredSeller,
            "Invalid contract account address"
        );

        // Mark the order as fulfilled before external calls
        fulfilledOrders[orderHash] = true;

        // Platform fee
        uint256 platformFee;

        // First fetch the price in ETH to calculate platform fee
        uint256 priceInETH = oracleHandler.getLatestPriceInETH(
            order.toFulfill.asset
        );

        // Fee calculation
        platformFee = (priceInETH * PLATFORM_FEE_BPS * FACTOR) / (100 * FACTOR);
        require(msg.value >= platformFee, "Insufficient ETH for platform fee");

        // Function trigger order
        require(
            contractAccount.execute(
                recoveredSeller,
                order.toSell.daoAddress,
                order.toSell.data,
                0
            ),
            "Function trigger order execute failed"
        );

        // Handle asset transfers
        _handleAssetTransfer(order.toFulfill, order.buyer, order.seller);

        // Emit order fulfillment event
        emit OrderFulfilled(orderHash, order.buyer, 0); //set platformfee to 0 for testing
    }

    // Buyer brings the signed order
    function fulfillOffchainOrderWithMerkleProof(
        Order memory order,
        bytes memory sellerSignature,
        bytes32[] calldata merkleProof,
        address contractAccountAddress
    ) public payable {
        require(block.timestamp <= order.deadline, "Order expired");
        bytes32 orderHash = getOrderHash(order);
        require(!fulfilledOrders[orderHash], "Order already fulfilled");
        require(!canceledOrders[orderHash], "Order not cancelled");

        address recoveredSeller = recoverSigner(orderHash, sellerSignature);

        require(
            _verifyMerkleProof(
                merkleProof,
                merkleRoots[recoveredSeller],
                orderHash
            ),
            "Invalid merkle proof"
        );

        // Ensure the recovered address matches the seller in the order
        require(recoveredSeller == order.seller, "Invalid signature");

        // Ensure the recovered address owned the contract account
        IContractAccount contractAccount = IContractAccount(
            contractAccountAddress
        );
        require(
            contractAccount.owner() == recoveredSeller,
            "Invalid contract account address"
        );

        // Mark the order as fulfilled before external calls
        fulfilledOrders[orderHash] = true;

        // Platform fee
        uint256 platformFee;

        // First fetch the price in ETH to calculate platform fee
        uint256 priceInETH = oracleHandler.getLatestPriceInETH(
            order.toFulfill.asset
        );

        // Fee calculation
        platformFee = (priceInETH * PLATFORM_FEE_BPS * FACTOR) / (100 * FACTOR);
        require(msg.value >= platformFee, "Insufficient ETH for platform fee");

        // Function trigger order
        require(
            contractAccount.execute(
                recoveredSeller,
                order.toSell.daoAddress,
                order.toSell.data,
                0
            ),
            "Function trigger order execute failed"
        );

        // Handle asset transfers
        _handleAssetTransfer(order.toFulfill, order.buyer, order.seller);

        // Emit order fulfillment event
        emit OrderFulfilled(orderHash, order.buyer, 0); //set platformfee to 0 for testing
    }

    // Generates the order hash
    function getOrderHash(Order memory order) public pure returns (bytes32) {
        return
            keccak256(
                bytes.concat(
                    keccak256(
                        abi.encode(
                            order.eid,
                            order.buyer,
                            order.seller,
                            order.toSell.daoAddress,
                            order.toSell.data,
                            order.toFulfill.asset,
                            order.toFulfill.amountOrTokenId,
                            order.deadline,
                            order.fulfilled
                        )
                    )
                )
            );
    }

    // Generates the order hash
    function getOrderHashBasic(
        OrderBasic memory order
    ) public pure returns (bytes32) {
        return
            keccak256(
                bytes.concat(
                    keccak256(
                        abi.encode(
                            order.eid,
                            order.buyer,
                            order.seller,
                            order.toSell.asset,
                            order.toSell.amountOrTokenId,
                            order.toFulfill.asset,
                            order.toFulfill.amountOrTokenId,
                            order.deadline,
                            order.fulfilled
                        )
                    )
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

    function updateMerkleRoot(bytes32 newMerkleRoot) public {
        merkleRoots[msg.sender] = newMerkleRoot;
    }

    // Verify merkle proof
    function _verifyMerkleProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        return proof.verify(root, leaf);
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

    function withdraw() external onlyOwner {
        require(address(this).balance > 0, "No balance to withdraw");
        payable(owner).transfer(address(this).balance);
        emit Withdraw(owner, address(this).balance);
    }

    function sweepOrders(
        OrderBasic[] memory orders,
        bytes[] memory sellerSignatures
    ) external payable {
        uint256 totalPlatformFee;
        uint256 totalSellAmount;
        uint256 totalFulfillAmount;
        // assuming all assets are the same
        address toFulfillAsset = orders[0].toFulfill.asset;
        address toSellAsset = orders[0].toSell.asset;

        for (uint256 i = 0; i < orders.length; i++) {
            OrderBasic memory order = orders[i];
            bytes memory sellerSignature = sellerSignatures[i];

            // Ensure order validity
            require(block.timestamp <= order.deadline, "Order expired");

            bytes32 orderHash = getOrderHashBasic(order);
            require(!fulfilledOrders[orderHash], "Order already fulfilled");
            require(!canceledOrders[orderHash], "Order already cancelled");

            // Verify the seller's signature
            address recoveredSeller = recoverSigner(orderHash, sellerSignature);
            require(recoveredSeller == order.seller, "Invalid signature");

            // Add up order values
            totalSellAmount += order.toSell.amountOrTokenId;
            totalFulfillAmount += order.toFulfill.amountOrTokenId;

            // Platform fee calculation
            uint256 priceInETH = oracleHandler.getLatestPriceInETH(
                toFulfillAsset
            );

            uint256 fee = (priceInETH * PLATFORM_FEE_BPS * FACTOR) /
                (100 * FACTOR);
            totalPlatformFee += fee;

            // Mark order as fulfilled
            fulfilledOrders[orderHash] = true;
            emit OrderFulfilled(orderHash, order.buyer, 0);
        }

        // Ensure sufficient ETH for the platform fee
        require(
            msg.value >= totalPlatformFee,
            "Insufficient ETH for platform fee"
        );

        // Transfer combined sell amount
        _handleAssetTransfer(
            Item({asset: toSellAsset, amountOrTokenId: totalSellAmount}),
            orders[0].seller,
            msg.sender
        );

        // Transfer combined fulfill amount
        _handleAssetTransfer(
            Item({asset: toFulfillAsset, amountOrTokenId: totalFulfillAmount}),
            msg.sender,
            orders[0].seller
        );
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    receive() external payable {}
}
