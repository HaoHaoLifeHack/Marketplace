// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IPriceFeed {
    function latestAnswer() external view returns (int256);

    function decimals() external view returns (uint8);
}

contract OracleHandler {
    address public owner;
    mapping(address => address) public assetPriceFeeds; // Mapping of asset to price feed
    mapping(address => bool) public denoteETHStatus; // Track denomination of each price feed
    address public wethAddress = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    IPriceFeed public usdcEthPriceFeed; // Price feed for USDC to ETH
    IPriceFeed public nftPriceFeed; // Price feed for NFTs to ETH

    constructor(IPriceFeed _usdcEthPriceFeed) {
        owner = msg.sender;
        usdcEthPriceFeed = _usdcEthPriceFeed;
    }

    /**
     * @dev Adds a new asset and its price feed with its denomination.
     * @param asset The address of the asset (e.g., USDC, USDT).
     * @param priceFeed The address of the Chainlink price feed for that asset.
     * @param isDenoteByETH The denomination of the price feed is ETH or not.
     */
    function setChainlinkPriceFeed(
        address asset,
        address priceFeed,
        bool isDenoteByETH
    ) external onlyOwner {
        require(priceFeed != address(0), "Invalid price feed address");
        assetPriceFeeds[asset] = priceFeed;
        denoteETHStatus[asset] = isDenoteByETH;
    }

    /**
     * @dev Converts the asset price (e.g., in USD) into ETH.
     * @param asset The asset address for which the price is being requested.
     * @return The price of the asset in ETH.
     */
    function getLatestPriceInETH(
        address asset
    ) external view returns (uint256) {
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
        int256 ethPriceRaw = usdcEthPriceFeed.latestAnswer();
        require(ethPriceRaw > 0, "Invalid ETH price");

        uint256 ethPrice = uint256(ethPriceRaw);
        uint8 ethDecimals = usdcEthPriceFeed.decimals();

        // Convert USD price to ETH
        return
            _convertUSDToETH(assetPrice, assetDecimals, ethPrice, ethDecimals);
    }

    /**
     * @dev Converts a price from USD to ETH terms
     * @param assetPriceUSD Asset price in USD
     * @param assetDecimals Decimals of asset price feed
     * @param ethPriceUSD ETH price in USD
     * @param ethDecimals Decimals of ETH price feed
     * @return Price in ETH terms (18 decimals)
     */
    function _convertUSDToETH(
        uint256 assetPriceUSD,
        uint8 assetDecimals,
        uint256 ethPriceUSD,
        uint8 ethDecimals
    ) internal pure returns (uint256) {
        // Scale to common base (1e18) before division
        uint256 scaledAssetPrice = (assetPriceUSD * 1e18) /
            (10 ** assetDecimals);
        uint256 scaledEthPrice = (ethPriceUSD * 1e18) / (10 ** ethDecimals);

        // Calculate: (assetPriceUSD * 1e18) / ethPriceUSD
        return (scaledAssetPrice * 1e18) / scaledEthPrice;
    }

    /**
     * @dev Adjusts price to 18 decimals (ETH standard)
     */
    function _adjustToEthDecimals(
        uint256 price,
        uint8 decimals
    ) internal pure returns (uint256) {
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

    /**
     * @dev Converts USD to ETH using the latest ETH price in USD.
     * @param assetPrice The asset price in USD.
     * @param ethPriceInUSD The ETH price in USD.
     * @return The asset price in ETH.
     */
    function _convertToETH(
        uint256 assetPrice,
        uint256 ethPriceInUSD
    ) internal pure returns (uint256) {
        return (assetPrice * 1e18) / ethPriceInUSD; // Convert with 18 decimals
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
