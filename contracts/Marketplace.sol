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

  uint256 public constant PLATFORM_FEE_BPS = 5; // 5.00% in basis points
  uint256 public constant FACTOR = 100000000; // Precision factor to simulate decimals
  uint256 private constant LIMIT = 25;

  event OrderCancelled(bytes32 indexed orderHash, uint256 indexed timestamp);
  event OrderFulfilled(bytes32 indexed orderHash, address indexed buyer, uint256 platformFee, uint256 indexed timestamp);
  event Withdraw(address indexed receiver, uint256 amount, uint256 indexed timestamp);

  constructor(OracleHandler _oracleHandler) {
    owner = msg.sender;
    oracleHandler = _oracleHandler;
  }

  function cancelMerkleOrders() external {
    require(merkleRoots[msg.sender] != 0, "The Seller has no order yet");
    merkleRoots[msg.sender] = 0x0;
  }

  function updateMerkleRoot(bytes32 newMerkleRoot) public {
    merkleRoots[msg.sender] = newMerkleRoot;
  }

  function cancelOrder(Order memory order, bytes memory sellerSignature) external {
    bytes32 orderHash = _validateOrderWithProof(order, sellerSignature, new bytes32[](0), false);
    canceledOrders[orderHash] = true;
    emit OrderCancelled(orderHash, block.timestamp);
  }

  function fulfillOffchainOrder(Order memory order, bytes memory sellerSignature) public payable {
    bytes32 orderHash = _getOrderHash(order);
    _validateOrder(orderHash, order.seller, sellerSignature, order.deadline);
    _fulfillOrder(order, orderHash, sellerSignature);
  }

  function fulfillOffchainOrderWithMerkleProof(Order memory order, bytes memory sellerSignature, bytes32[] calldata merkleProof) public payable {
    // Validate the order and return its hash
    bytes32 orderHash = _validateOrderWithProof(order, sellerSignature, merkleProof, true);

    _fulfillOrder(order, orderHash, sellerSignature);
  }

  function _fulfillOrder(Order memory order, bytes32 orderHash, bytes memory sellerSignature) internal {
    // Mark the order as fulfilled
    fulfilledOrders[orderHash] = true;

    // Calculate and require platform fee payment
    uint256 platformFee = _calculatePlatformFee(order.toFulfill.asset, order.toFulfill.amountOrTokenIds[0]);
    require(msg.value >= platformFee, "Insufficient ETH for platform fee");

    // Execute the order based on seller type (contract or EOA)
    _executeOrder(order, orderHash, sellerSignature);

    // Finalize the order with asset transfer
    AssetType toFulfillAssetType = _checkAssetType(order.toFulfill.asset);
    _handleAssetTransfer(toFulfillAssetType, order.toFulfill, order.buyer, order.seller);
    emit OrderFulfilled(orderHash, order.buyer, platformFee, block.timestamp);
  }

  function _calculatePlatformFee(address asset, uint256 amount) internal view returns (uint256) {
    uint256 priceInETH = oracleHandler.getLatestPriceInETH(asset);
    return ((priceInETH * amount * PLATFORM_FEE_BPS * FACTOR) / (100 * FACTOR)) / 1e18;
  }

  function _recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
    return _getEthSignedMessageHash(hash).recover(signature);
  }

  function _getEthSignedMessageHash(bytes32 _messageHash) internal pure returns (bytes32) {
    /*
        Signature is produced by signing a keccak256 hash with the following format:
        "\x19Ethereum Signed Message\n" + len(msg) + msg
        */
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
  }

  function _validateOrderWithProof(
    Order memory order,
    bytes memory sellerSignature,
    bytes32[] memory merkleProof,
    bool useMerkleProof
  ) internal view returns (bytes32) {
    // Generate order hash and validate core order parameters
    bytes32 orderHash = _getOrderHash(order);
    _validateOrder(orderHash, order.seller, sellerSignature, order.deadline);

    if (useMerkleProof) {
      require(_verifyMerkleProof(order.seller, merkleProof, orderHash), "Invalid merkle proof");
    }

    return orderHash;
  }

  function _validateBasicOrder(OrderBasic memory order, bytes memory sellerSignature) internal view returns (bytes32) {
    bytes32 orderHash = _getOrderHashBasic(order);
    _validateOrder(orderHash, order.seller, sellerSignature, order.deadline);

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

  function _getOrderHashBasic(OrderBasic memory order) internal pure returns (bytes32) {
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
  function _validateOrder(bytes32 orderHash, address seller, bytes memory sellerSignature, uint256 deadline) internal view {
    require(block.timestamp <= deadline, "Order expired");
    require(!fulfilledOrders[orderHash], "Order already fulfilled");
    require(!canceledOrders[orderHash], "Order already cancelled");
    require(_isValidSeller(seller, _recoverSigner(orderHash, sellerSignature)), "Invalid signature");
  }

  // Validate seller address
  function _isValidSeller(address seller, address recoveredSeller) internal view returns (bool) {
    if (_isContract(seller)) {
      return recoveredSeller == IContractAccount(seller).owner();
    } else {
      return recoveredSeller == seller;
    }
  }

  function _verifyMerkleProof(address seller, bytes32[] memory proof, bytes32 leaf) internal view returns (bool) {
    return proof.verify(merkleRoots[seller], leaf);
  }

  // Execute the order based on seller account type (EOA or contract)
  function _executeOrder(Order memory order, bytes32 orderHash, bytes memory sellerSignature) internal {
    if (_isContract(order.seller)) {
      IContractAccount(order.seller).execute(orderHash, sellerSignature, order.toSell.executeAddress, order.toSell.data);
    } else {
      (bool success, ) = order.toSell.executeAddress.call(order.toSell.data);
      require(success, "Transfer toSell asset to buyer failed");
    }
  }

  function sweepOrders(OrderBasic[] memory orders, bytes[] memory sellerSignatures) external payable {
    uint256 totalPlatformFee = _calculateTotalPlatformFee(orders);
    require(msg.value >= totalPlatformFee, "Insufficient ETH for platform fee");

    uint256 MAX_DISTINCT_TOKENS = 10;
    address[] memory erc20TokensToSell = new address[](MAX_DISTINCT_TOKENS);
    address[] memory erc20TokensToFulfill = new address[](MAX_DISTINCT_TOKENS);
    uint256[] memory erc20ToSellTotalAmounts = new uint256[](MAX_DISTINCT_TOKENS);
    uint256[] memory erc20ToFulfillTotalAmounts = new uint256[](MAX_DISTINCT_TOKENS);

    uint256 sellTokenCount;
    uint256 fulfillTokenCount;

    for (uint256 i = 0; i < orders.length; i++) {
      OrderBasic memory order = orders[i];
      AssetType toSellType = _checkAssetType(order.toSell.asset);
      AssetType toFulfillType = _checkAssetType(order.toFulfill.asset);

      bytes memory sellerSignature = sellerSignatures[i];
      bytes32 orderHash = _validateBasicOrder(order, sellerSignature);
      fulfilledOrders[orderHash] = true;

      emit OrderFulfilled(orderHash, order.buyer, totalPlatformFee, block.timestamp);

      // Aggregate sell and fulfill assets
      if (toSellType == AssetType.ERC20) {
        (sellTokenCount, erc20TokensToSell, erc20ToSellTotalAmounts) = _aggregateToken(
          erc20TokensToSell,
          erc20ToSellTotalAmounts,
          order.toSell.asset,
          order.toSell.amountOrTokenIds[0],
          sellTokenCount,
          MAX_DISTINCT_TOKENS
        );
      } else {
        _handleAssetTransfer(toSellType, order.toSell, order.seller, msg.sender);
      }

      if (toFulfillType == AssetType.ERC20) {
        (fulfillTokenCount, erc20TokensToFulfill, erc20ToFulfillTotalAmounts) = _aggregateToken(
          erc20TokensToFulfill,
          erc20ToFulfillTotalAmounts,
          order.toFulfill.asset,
          order.toFulfill.amountOrTokenIds[0],
          fulfillTokenCount,
          MAX_DISTINCT_TOKENS
        );
      } else {
        _handleAssetTransfer(toFulfillType, order.toFulfill, order.seller, msg.sender);
      }
    }

    // Perform aggregated transfers for each unique ERC20 token
    _sweepERC20Orders(erc20TokensToSell, erc20ToSellTotalAmounts, msg.sender, true); // Transfer toSell to buyer
    _sweepERC20Orders(erc20TokensToFulfill, erc20ToFulfillTotalAmounts, msg.sender, false); // Transfer toFulfill to seller
  }

  function sweepERC20Orders(OrderBasic[] memory orders, bytes[] memory sellerSignatures) external payable {
    uint256 totalPlatformFee = _calculateTotalPlatformFee(orders);
    require(msg.value >= totalPlatformFee, "Insufficient ETH for platform fee");

    uint256 MAX_DISTINCT_TOKENS = 10;
    address[] memory erc20TokensToSell = new address[](MAX_DISTINCT_TOKENS);
    address[] memory erc20TokensToFulfill = new address[](MAX_DISTINCT_TOKENS);
    uint256[] memory erc20ToSellTotalAmounts = new uint256[](MAX_DISTINCT_TOKENS);
    uint256[] memory erc20ToFulfillTotalAmounts = new uint256[](MAX_DISTINCT_TOKENS);

    uint256 sellTokenCount;
    uint256 fulfillTokenCount;

    for (uint256 i = 0; i < orders.length; i++) {
      OrderBasic memory order = orders[i];
      require(
        _checkAssetType(order.toSell.asset) == AssetType.ERC20 && _checkAssetType(order.toFulfill.asset) == AssetType.ERC20,
        "Only ERC20 tokens allowed"
      );

      bytes32 orderHash = _validateBasicOrder(order, sellerSignatures[i]);
      fulfilledOrders[orderHash] = true;
      emit OrderFulfilled(orderHash, order.buyer, totalPlatformFee, block.timestamp);

      // Aggregate `toSell` and `toFulfill` assets
      (sellTokenCount, erc20TokensToSell, erc20ToSellTotalAmounts) = _aggregateToken(
        erc20TokensToSell,
        erc20ToSellTotalAmounts,
        order.toSell.asset,
        order.toSell.amountOrTokenIds[0],
        sellTokenCount,
        MAX_DISTINCT_TOKENS
      );
      (fulfillTokenCount, erc20TokensToFulfill, erc20ToFulfillTotalAmounts) = _aggregateToken(
        erc20TokensToFulfill,
        erc20ToFulfillTotalAmounts,
        order.toFulfill.asset,
        order.toFulfill.amountOrTokenIds[0],
        fulfillTokenCount,
        MAX_DISTINCT_TOKENS
      );
    }

    _sweepERC20Orders(erc20TokensToSell, erc20ToSellTotalAmounts, msg.sender, true); // Transfer toSell to buyer
    _sweepERC20Orders(erc20TokensToFulfill, erc20ToFulfillTotalAmounts, msg.sender, false); // Transfer toFulfill to seller
  }

  // Helper function to aggregate token amounts
  function _aggregateToken(
    address[] memory tokens,
    uint256[] memory totalAmounts,
    address asset,
    uint256 amount,
    uint256 tokenCount,
    uint256 maxTokens
  ) internal pure returns (uint256, address[] memory, uint256[] memory) {
    for (uint256 j = 0; j < tokenCount; j++) {
      if (tokens[j] == asset) {
        totalAmounts[j] += amount;
        return (tokenCount, tokens, totalAmounts);
      }
    }

    require(tokenCount < maxTokens, "Too many distinct tokens");
    tokens[tokenCount] = asset;
    totalAmounts[tokenCount] = amount;
    return (tokenCount + 1, tokens, totalAmounts);
  }

  function _sweepERC20Orders(address[] memory tokens, uint256[] memory totalAmounts, address primaryAddress, bool isToBuyer) internal {
    for (uint256 i = 0; i < tokens.length; i++) {
      if (tokens[i] == address(0)) break; // End loop if address array contains empty slots
      uint256 totalAmount = totalAmounts[i];
      if (totalAmount > 0) {
        address to = isToBuyer ? primaryAddress : msg.sender;
        address from = isToBuyer ? msg.sender : primaryAddress;
        require(IERC20(tokens[i]).transferFrom(from, to, totalAmount), "ERC20 transfer failed");
      }
    }
  }

  // Calculates the total platform fee for all orders
  function _calculateTotalPlatformFee(OrderBasic[] memory orders) internal view returns (uint256) {
    uint256 totalPlatformFee;
    for (uint256 i = 0; i < orders.length; i++) {
      uint256 priceInETH = oracleHandler.getLatestPriceInETH(orders[i].toFulfill.asset);
      uint256 fee = (priceInETH * orders[i].toFulfill.amountOrTokenIds[0] * PLATFORM_FEE_BPS * FACTOR) / (100 * FACTOR);
      totalPlatformFee += fee;
    }
    return totalPlatformFee;
  }

  // Handles transfers for ERC20, ERC721, and ERC1155 tokens, including batch transfers
  function _handleAssetTransfer(AssetType assetType, ItemV2 memory item, address from, address to) internal {
    if (assetType == AssetType.ERC721) {
      // ERC721: Single token transfer
      require(item.amountOrTokenIds.length == 1, "ERC721 supports only one tokenId");
      IERC721(item.asset).safeTransferFrom(from, to, item.amountOrTokenIds[0]);
    } else if (assetType == AssetType.ERC1155) {
      if (item.ids.length > 1) {
        // ERC1155: Batch transfer with separate IDs
        require(item.amountOrTokenIds.length == item.ids.length, "Mismatch between amounts and IDs");
        IERC1155(item.asset).safeBatchTransferFrom(from, to, item.ids, item.amountOrTokenIds, "");
      } else {
        // ERC1155: Single item transfer
        require(item.amountOrTokenIds.length == 1, "ERC1155 single item transfer requires one amount");
        IERC1155(item.asset).safeTransferFrom(from, to, item.ids[0], item.amountOrTokenIds[0], "");
      }
    } else {
      // ERC20: Single amount transfer (assume single value in amountOrTokenIds for ERC20)
      require(item.amountOrTokenIds.length == 1, "ERC20 transfer requires single amount");
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
  function _checkAssetType(address asset) internal view returns (AssetType) {
    if (_isERC721(asset)) {
      return AssetType.ERC721;
    } else if (_isERC1155(asset)) {
      return AssetType.ERC1155;
    } else {
      return AssetType.ERC20;
    }
  }

  function _isERC20(address asset) internal view returns (bool) {
    return !_isERC1155(asset) && !_isERC721(asset);
  }

  function _isERC721(address asset) internal view returns (bool) {
    return _supportsInterface(asset, type(IERC721).interfaceId);
  }

  function _isERC1155(address asset) internal view returns (bool) {
    return _supportsInterface(asset, type(IERC1155).interfaceId);
  }

  enum AssetType {
    ERC20,
    ERC721,
    ERC1155,
    TriggerTask,
    INVALID
  }

  function _supportsInterface(address asset, bytes4 interfaceId) internal view returns (bool) {
    bytes memory data = abi.encodeWithSelector(IERC165.supportsInterface.selector, interfaceId);
    (bool success, bytes memory result) = asset.staticcall(data);

    if (!success) return false;
    return abi.decode(result, (bool));
  }

  function withdraw() external onlyOwner {
    require(address(this).balance > 0, "No balance to withdraw");
    uint256 previousBalance = address(this).balance;
    payable(owner).transfer(address(this).balance);
    emit Withdraw(owner, previousBalance, block.timestamp);
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Only owner can call this function");
    _;
  }

  receive() external payable {}
}
