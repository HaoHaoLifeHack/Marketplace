// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IPriceFeed {
    function latestAnswer() external view returns (uint256);

    function decimals() external view returns (uint8);
}

contract OracleHandler {
    mapping(address => address) public assetPriceFeeds; // Mapping of asset address to price feed
    IPriceFeed public usdcEthPriceFeed; // Price feed for USDC to ETH
    IPriceFeed public nftPriceFeed; // Price feed for NFTs to ETH

    constructor(IPriceFeed _usdcEthPriceFeed) {
        usdcEthPriceFeed = _usdcEthPriceFeed;
    }

    /**
     * @dev Adds a new asset and its price feed.
     * @param asset The pair name of the asset (e.g., USDC/ETH, USDT/ETH).
     * @param priceFeed The address of the Chainlink price feed for that asset.
     */
    function setChainlinkPriceFeed(address asset, address priceFeed) external {
        require(priceFeed != address(0), "Invalid price feed address");
        assetPriceFeeds[asset] = priceFeed;
    }

    /**
     * @dev Converts the asset price (e.g., in USD) into ETH.
     * @param asset The pair name of the asset (e.g., USDC/ETH, USDT/ETH) for which the price is being requested.
     * @return The price of the asset in ETH.
     */
    function getLatestPriceInETH(
        address asset
    ) external view returns (uint256) {
        address priceFeedAddress = assetPriceFeeds[asset];
        require(priceFeedAddress != address(0), "Invalid price feed address");
        IPriceFeed assetPriceFeed = IPriceFeed(priceFeedAddress);
        uint256 assetPrice = assetPriceFeed.latestAnswer() /
            assetPriceFeed.decimals();
        require(assetPrice > 0, "Invalid asset price from oracle");

        // Convert the asset price from USD to ETH
        if ((assetPriceFeed.decimals()) == 18) {
            return assetPrice;
        }
        uint256 ethPriceInUSD = usdcEthPriceFeed.latestAnswer();
        require(ethPriceInUSD > 0, "Invalid ETH price from oracle");
        return _convertToETH(assetPrice, ethPriceInUSD);
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
}

contract NFTPriceFeed is IPriceFeed {
    function latestAnswer() external pure returns (uint256) {
        return 10 ether;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }
}
