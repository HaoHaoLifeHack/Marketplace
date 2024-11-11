// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

interface IPriceFeed {
  function latestAnswer() external view returns (int256);

  function decimals() external view returns (uint8);
}

contract OracleHandler {
  address public owner;
  mapping(address => address) public assetPriceFeeds; // Mapping of asset to price feed
  mapping(address => bool) public denoteETHStatus; // Track denomination of each price feed
  address public wethAddress;
  IPriceFeed public usdcEthPriceFeed; // Price feed for USDC to ETH
  IPriceFeed public nftPriceFeed; // Price feed for NFTs to ETH

  constructor(IPriceFeed _usdcEthPriceFeed, address _wethAddress) {
    owner = msg.sender;
    usdcEthPriceFeed = _usdcEthPriceFeed;
    wethAddress = _wethAddress;
  }

  /**
   * @dev Adds a new asset and its price feed with its denomination.
   * @param asset The address of the asset (e.g., USDC, USDT).
   * @param priceFeed The address of the Chainlink price feed for that asset.
   * @param isDenoteByETH The denomination of the price feed is ETH or not.
   */
  function setChainlinkPriceFeed(address asset, address priceFeed, bool isDenoteByETH) external onlyOwner {
    require(priceFeed != address(0), "Invalid price feed address");
    assetPriceFeeds[asset] = priceFeed;
    denoteETHStatus[asset] = isDenoteByETH;
  }

  /**
   * @dev Converts the asset price (e.g., in USD) into ETH.
   * @param asset The asset address for which the price is being requested.
   * @return The price of the asset in ETH.
   */
  function getLatestPriceInETH(address asset) external view returns (uint256) {
    if (_isWETH(asset)) {
      return 1 ether;
    }
    address priceFeedAddress = assetPriceFeeds[asset];
    require(priceFeedAddress != address(0), "Invalid price feed address");

    IPriceFeed assetPriceFeed = IPriceFeed(priceFeedAddress);
    int256 assetPriceRaw = assetPriceFeed.latestAnswer();
    require(assetPriceRaw > 0, "Invalid asset price from oracle");

    uint256 assetPrice = uint256(assetPriceRaw);
    uint8 assetDecimals = assetPriceFeed.decimals();

    // If asset is already denominated in ETH, adjust decimals and return
    if (denoteETHStatus[asset]) {
      return _adjustToEthDecimals(assetPrice, assetDecimals);
    }

    // Convert from USD to ETH
    int256 usdPriceETHRaw = usdcEthPriceFeed.latestAnswer();
    require(usdPriceETHRaw > 0, "Invalid ETH price");

    uint256 usdPriceETHPrice = uint256(usdPriceETHRaw);

    // Convert USD price to ETH
    return _convertUSDToETH(assetPrice, assetDecimals, usdPriceETHPrice);
  }

  /**
   * @dev Converts a price from USD to ETH terms
   * @param assetPriceUSD Asset price in USD
   * @param assetDecimals Decimals of asset price feed
   * @param usdPriceETH USD price in ETH
   * @return Price in ETH terms (18 decimals)
   */
  function _convertUSDToETH(uint256 assetPriceUSD, uint8 assetDecimals, uint256 usdPriceETH) internal pure returns (uint256) {
    return (assetPriceUSD * usdPriceETH) / (10 ** assetDecimals);
  }

  /**
   * @dev Adjusts price to 18 decimals (ETH standard)
   */
  function _adjustToEthDecimals(uint256 price, uint8 decimals) internal pure returns (uint256) {
    if (decimals < 18) {
      return price * (10 ** (18 - decimals));
    } else if (decimals > 18) {
      return price / (10 ** (decimals - 18));
    }
    return price;
  }

  function _isWETH(address asset) internal view returns (bool) {
    return asset == wethAddress;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Only owner can call this function");
    _;
  }
}

contract NFTPriceFeed is IPriceFeed {
  int256 public price = 10 ether;

  function latestAnswer() external view returns (int256) {
    return price;
  }

  function decimals() external pure returns (uint8) {
    return 18;
  }

  function setPrice(int256 _price) external {
    price = _price;
  }
}
