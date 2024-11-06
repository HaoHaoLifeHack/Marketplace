// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./OracleHandler.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/IContractAccount.sol";
import "./interfaces/IDAO.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Marketplace is IMarketplace {
    using ECDSA for bytes32;
    using MerkleProof for bytes32[];
    address owner;
    OracleHandler public oracleHandler;

    mapping(address => bytes32) public merkleRoots; //Seperate by the seller
    mapping(bytes32 => bool) public canceledOrders; //Map orderHash to bool
    mapping(bytes32 => bool) public fulfilledOrders; //Map orderHash to bool

    // Track ERC20 token addresses and amounts to aggregate transfers
    address[] private _erc20TokensToSell;
    address[] private _erc20TokensToFulfill;
    mapping(address => uint256) private _erc20ToSellTotalAmounts;
    mapping(address => uint256) private _erc20ToFulfillTotalAmounts;

    uint256 public constant PLATFORM_FEE_BPS = 5; // 5.00% in basis points
    uint256 public constant FACTOR = 100000000; // Precision factor to simulate decimals
    uint256 private constant LIMIT = 25;

    event OrderCancelled(bytes32 indexed orderHash, uint256 indexed timestamp);
    event OrderFulfilled(
        bytes32 indexed orderHash,
        address indexed buyer,
        uint256 platformFee,
        uint256 indexed timestamp
    );
    event Withdraw(
        address indexed receiver,
        uint256 amount,
        uint256 indexed timestamp
    );

    constructor(OracleHandler _oracleHandler) {
        owner = msg.sender;
        oracleHandler = _oracleHandler;
    }

    function cancelMerkleOrders() external {
        require(merkleRoots[msg.sender] != 0, "The Seller has no order yet");
        updateMerkleRoot("0x0");
    }

    function updateMerkleRoot(bytes32 newMerkleRoot) public {
        merkleRoots[msg.sender] = newMerkleRoot;
    }

    function cancelOrder(
        Order memory order,
        bytes memory sellerSignature
    ) external {
        bytes32 orderHash = _validateOrderWithProof(
            order,
            sellerSignature,
            new bytes32[](0),
            false
        );
        canceledOrders[orderHash] = true;
        emit OrderCancelled(orderHash, block.timestamp);
    }

    function fulfillOffchainOrder(
        Order memory order,
        bytes memory sellerSignature
    ) public payable {
        _fulfillOrder(order, sellerSignature, new bytes32[](0), false);
    }

    function fulfillOffchainOrderWithMerkleProof(
        Order memory order,
        bytes memory sellerSignature,
        bytes32[] calldata merkleProof
    ) public payable {
        _fulfillOrder(order, sellerSignature, merkleProof, true);
    }

    function _fulfillOrder(
        Order memory order,
        bytes memory sellerSignature,
        bytes32[] memory merkleProof,
        bool useMerkleProof
    ) internal {
        // Validate the order and return its hash
        bytes32 orderHash = _validateOrderWithProof(
            order,
            sellerSignature,
            merkleProof,
            useMerkleProof
        );

        // Mark the order as fulfilled
        fulfilledOrders[orderHash] = true;

        // Calculate and require platform fee payment
        uint256 platformFee = _calculatePlatformFee(order.toFulfill.asset);
        require(msg.value >= platformFee, "Insufficient ETH for platform fee");

        // Execute the order based on seller type (contract or EOA)
        _executeOrder(order, orderHash, sellerSignature);

        // Finalize the order with asset transfer
        _handleAssetTransfer(order.toFulfill, order.buyer, order.seller);
        emit OrderFulfilled(
            orderHash,
            order.buyer,
            platformFee,
            block.timestamp
        );
    }

    function _calculatePlatformFee(
        address asset
    ) internal view returns (uint256) {
        uint256 priceInETH = oracleHandler.getLatestPriceInETH(asset);
        return (priceInETH * PLATFORM_FEE_BPS * FACTOR) / (100 * FACTOR);
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

    function _validateOrderWithProof(
        Order memory order,
        bytes memory sellerSignature,
        bytes32[] memory merkleProof,
        bool useMerkleProof
    ) internal view returns (bytes32) {
        // Generate order hash and validate core order parameters
        bytes32 orderHash = _getOrderHash(order);
        _validateOrder(
            orderHash,
            order.seller,
            sellerSignature,
            order.deadline
        );

        if (useMerkleProof) {
            _verifyMerkleProof(order.seller, merkleProof, orderHash);
        }

        return orderHash;
    }

    function _validateBasicOrder(
        OrderBasic memory order,
        bytes memory sellerSignature
    ) internal view returns (bytes32) {
        bytes32 orderHash = _getOrderHashBasic(order);
        _validateOrder(
            orderHash,
            order.seller,
            sellerSignature,
            order.deadline
        );

        return orderHash;
    }

    function _getOrderHash(Order memory order) internal pure returns (bytes32) {
        return
            keccak256(
                bytes.concat(
                    keccak256(
                        abi.encode(
                            order.eid,
                            order.buyer,
                            order.seller,
                            order.toSell.executeAddress,
                            order.toSell.data,
                            order.toFulfill.asset,
                            order.toFulfill.ids,
                            order.toFulfill.amountOrTokenIds,
                            order.deadline,
                            order.fulfilled
                        )
                    )
                )
            );
    }

    function _getOrderHashBasic(
        OrderBasic memory order
    ) internal pure returns (bytes32) {
        return
            keccak256(
                bytes.concat(
                    keccak256(
                        abi.encode(
                            order.eid,
                            order.buyer,
                            order.seller,
                            order.toSell.asset,
                            order.toSell.ids,
                            order.toSell.amountOrTokenIds,
                            order.toFulfill.asset,
                            order.toFulfill.ids,
                            order.toFulfill.amountOrTokenIds,
                            order.deadline,
                            order.fulfilled
                        )
                    )
                )
            );
    }

    // Validate general order constraints
    function _validateOrder(
        bytes32 orderHash,
        address seller,
        bytes memory sellerSignature,
        uint256 deadline
    ) internal view {
        require(block.timestamp <= deadline, "Order expired");
        require(!fulfilledOrders[orderHash], "Order already fulfilled");
        require(!canceledOrders[orderHash], "Order already cancelled");
        require(
            _isValidSeller(seller, _recoverSigner(orderHash, sellerSignature)),
            "Invalid signature"
        );
    }

    // Validate seller address
    function _isValidSeller(
        address seller,
        address recoveredSeller
    ) internal view returns (bool) {
        if (_isContract(seller)) {
            return recoveredSeller == IContractAccount(seller).owner();
        } else {
            return recoveredSeller == seller;
        }
    }

    function _verifyMerkleProof(
        address seller,
        bytes32[] memory proof,
        bytes32 leaf
    ) internal view returns (bool) {
        return proof.verify(merkleRoots[seller], leaf);
    }

    // Execute the order based on seller account type (EOA or contract)
    function _executeOrder(
        Order memory order,
        bytes32 orderHash,
        bytes memory sellerSignature
    ) internal {
        if (_isContract(order.seller)) {
            IContractAccount(order.seller).execute(
                orderHash,
                sellerSignature,
                order.toSell.executeAddress,
                order.toSell.data
            );
        } else {
            (bool success, ) = order.toSell.executeAddress.call(
                order.toSell.data
            );
            require(success, "Transfer toSell asset to buyer failed");
        }
    }

    function sweepOrders(
        OrderBasic[] memory orders,
        bytes[] memory sellerSignatures
    ) external payable {
        uint256 totalPlatformFee = _calculateTotalPlatformFee(orders);
        require(
            msg.value >= totalPlatformFee,
            "Insufficient ETH for platform fee"
        );

        for (uint256 i = 0; i < orders.length; i++) {
            OrderBasic memory order = orders[i];
            bytes memory sellerSignature = sellerSignatures[i];

            bytes32 orderHash = _validateBasicOrder(order, sellerSignature);
            fulfilledOrders[orderHash] = true;

            emit OrderFulfilled(
                orderHash,
                order.buyer,
                totalPlatformFee,
                block.timestamp
            );

            // Accumulate ERC20 amounts or transfer non-ERC20 assets directly
            if (_isERC20(order.toSell.asset)) {
                if (_erc20ToSellTotalAmounts[order.toSell.asset] == 0) {
                    _erc20TokensToSell.push(order.toSell.asset);
                }
                _erc20ToSellTotalAmounts[order.toSell.asset] += order
                    .toSell
                    .amountOrTokenIds[0];
            } else {
                _handleAssetTransfer(order.toSell, order.seller, msg.sender);
            }

            if (_isERC20(order.toFulfill.asset)) {
                if (_erc20ToSellTotalAmounts[order.toFulfill.asset] == 0) {
                    _erc20TokensToFulfill.push(order.toFulfill.asset);
                }
                _erc20ToSellTotalAmounts[order.toFulfill.asset] += order
                    .toFulfill
                    .amountOrTokenIds[0];
            } else {
                _handleAssetTransfer(order.toFulfill, msg.sender, order.seller);
            }
        }

        // Perform aggregated transfers for each unique ERC20 token
        _sweepERC20Orders(
            _erc20TokensToSell,
            _erc20ToSellTotalAmounts,
            msg.sender,
            true
        ); // Transfer toSell to buyer
        _sweepERC20Orders(
            _erc20TokensToFulfill,
            _erc20ToSellTotalAmounts,
            msg.sender,
            false
        ); // Transfer toFulfill to seller
    }

    function sweepERC20Orders(
        OrderBasic[] memory orders,
        bytes[] memory sellerSignatures
    ) external payable {
        uint256 totalPlatformFee = _calculateTotalPlatformFee(orders);
        require(
            msg.value >= totalPlatformFee,
            "Insufficient ETH for platform fee"
        );
        // Aggregate ERC20 orders
        for (uint256 i = 0; i < orders.length; i++) {
            OrderBasic memory order = orders[i];
            require(
                _isERC20(order.toSell.asset) && _isERC20(order.toFulfill.asset),
                "Only ERC20 tokens allowed"
            );

            bytes memory sellerSignature = sellerSignatures[i];

            // Validate and mark the order as fulfilled
            bytes32 orderHash = _validateBasicOrder(order, sellerSignature);
            fulfilledOrders[orderHash] = true;

            emit OrderFulfilled(
                orderHash,
                order.buyer,
                totalPlatformFee,
                block.timestamp
            );

            // Accumulate ERC20 amounts

            if (_erc20ToSellTotalAmounts[order.toSell.asset] == 0) {
                _erc20TokensToSell.push(order.toSell.asset);
            }
            _erc20ToSellTotalAmounts[order.toSell.asset] += order
                .toSell
                .amountOrTokenIds[0];

            if (_erc20ToSellTotalAmounts[order.toFulfill.asset] == 0) {
                _erc20TokensToFulfill.push(order.toFulfill.asset);
            }
            _erc20ToSellTotalAmounts[order.toFulfill.asset] += order
                .toFulfill
                .amountOrTokenIds[0];
        }

        // Perform aggregated transfers for each unique ERC20 token
        _sweepERC20Orders(
            _erc20TokensToSell,
            _erc20ToSellTotalAmounts,
            msg.sender,
            true
        ); // Transfer toSell to buyer
        _sweepERC20Orders(
            _erc20TokensToFulfill,
            _erc20ToSellTotalAmounts,
            msg.sender,
            false
        ); // Transfer toFulfill to seller
    }

    // Transfers aggregated ERC20 tokens
    function _sweepERC20Orders(
        address[] memory tokens,
        mapping(address => uint256) storage totalAmounts,
        address primaryAddress,
        bool isToBuyer
    ) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 totalAmount = totalAmounts[token];

            if (totalAmount > 0) {
                address to = isToBuyer ? primaryAddress : msg.sender;
                address from = isToBuyer ? msg.sender : primaryAddress;

                // Perform the ERC20 transfer
                require(
                    IERC20(token).transferFrom(from, to, totalAmount),
                    "ERC20 transfer failed"
                );
            }
        }
    }

    // Calculates the total platform fee for all orders
    function _calculateTotalPlatformFee(
        OrderBasic[] memory orders
    ) internal view returns (uint256) {
        uint256 totalPlatformFee;
        for (uint256 i = 0; i < orders.length; i++) {
            uint256 priceInETH = oracleHandler.getLatestPriceInETH(
                orders[i].toFulfill.asset
            );
            uint256 fee = (priceInETH * PLATFORM_FEE_BPS * FACTOR) /
                (100 * FACTOR);
            totalPlatformFee += fee;
        }
        return totalPlatformFee;
    }

    // Handles transfers for ERC20, ERC721, and ERC1155 tokens, including batch transfers
    function _handleAssetTransfer(
        ItemV2 memory item,
        address from,
        address to
    ) internal {
        if (_isERC721(item.asset)) {
            // ERC721: Single token transfer
            require(
                item.amountOrTokenIds.length == 1,
                "ERC721 supports only one tokenId"
            );
            IERC721(item.asset).safeTransferFrom(
                from,
                to,
                item.amountOrTokenIds[0]
            );
        } else if (_isERC1155(item.asset)) {
            if (item.ids.length > 1) {
                // ERC1155: Batch transfer with separate IDs
                require(
                    item.amountOrTokenIds.length == item.ids.length,
                    "Mismatch between amounts and IDs"
                );
                IERC1155(item.asset).safeBatchTransferFrom(
                    from,
                    to,
                    item.ids,
                    item.amountOrTokenIds,
                    ""
                );
            } else {
                // ERC1155: Single item transfer
                require(
                    item.amountOrTokenIds.length == 1,
                    "ERC1155 single item transfer requires one amount"
                );
                IERC1155(item.asset).safeTransferFrom(
                    from,
                    to,
                    item.ids[0],
                    item.amountOrTokenIds[0],
                    ""
                );
            }
        } else {
            // ERC20: Single amount transfer (assume single value in amountOrTokenIds for ERC20)
            require(
                item.amountOrTokenIds.length == 1,
                "ERC20 transfer requires single amount"
            );
            IERC20(item.asset).transferFrom(from, to, item.amountOrTokenIds[0]);
        }
    }

    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account) // Get the code size at the address
        }
        return size > 0; // If size > 0, it's a contract
    }

    // Helper function to check if an asset supports a specific interface
    function _isERC20(address asset) internal view returns (bool) {
        return !_isERC1155(asset) && !_isERC721(asset);
    }

    function _isERC721(address asset) internal view returns (bool) {
        return _supportsInterface(asset, type(IERC721).interfaceId);
    }

    function _isERC1155(address asset) internal view returns (bool) {
        return _supportsInterface(asset, type(IERC1155).interfaceId);
    }

    function _supportsInterface(
        address asset,
        bytes4 interfaceId
    ) internal view returns (bool) {
        bytes memory data = abi.encodeWithSelector(
            IERC165.supportsInterface.selector,
            interfaceId
        );
        (bool success, bytes memory result) = asset.staticcall(data);

        if (!success) return false;
        return abi.decode(result, (bool));
    }

    function withdraw() external onlyOwner {
        require(address(this).balance > 0, "No balance to withdraw");
        payable(owner).transfer(address(this).balance);
        emit Withdraw(owner, address(this).balance, block.timestamp);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    receive() external payable {}
}
