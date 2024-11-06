// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IPriceFeed {
    function latestAnswer() external view returns (uint256);

    function decimals() external view returns (uint8);
}

contract OracleHandler {
    mapping(address => address) public assetPriceFeeds; // Mapping of asset to price feed
    mapping(address => string) public priceFeedDenominations; // Track denomination of each price feed
    address public wethAddress = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    IPriceFeed public usdcEthPriceFeed; // Price feed for USDC to ETH
    IPriceFeed public nftPriceFeed; // Price feed for NFTs to ETH

    constructor(IPriceFeed _usdcEthPriceFeed) {
        usdcEthPriceFeed = _usdcEthPriceFeed;
    }

    /**
     * @dev Adds a new asset and its price feed with its denomination.
     * @param asset The address of the asset (e.g., USDC, USDT).
     * @param priceFeed The address of the Chainlink price feed for that asset.
     * @param denomination The denomination of the price feed (e.g., "USD" or "ETH").
     */
    function setChainlinkPriceFeed(
        address asset,
        address priceFeed,
        string memory denomination
    ) external {
        require(priceFeed != address(0), "Invalid price feed address");
        require(
            keccak256(abi.encodePacked(denomination)) == keccak256("USD") ||
                keccak256(abi.encodePacked(denomination)) == keccak256("ETH"),
            "Unsupported denomination"
        );

        assetPriceFeeds[asset] = priceFeed;
        priceFeedDenominations[asset] = denomination;
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
        uint256 assetPrice = assetPriceFeed.latestAnswer() /
            10 ** assetPriceFeed.decimals();
        require(assetPrice > 0, "Invalid asset price from oracle");

        // Determine the denomination and apply conversion if needed
        string memory denomination = priceFeedDenominations[asset];
        if (keccak256(abi.encodePacked(denomination)) == keccak256("ETH")) {
            return assetPrice; // Already denominated in ETH, return directly
        } else if (
            keccak256(abi.encodePacked(denomination)) == keccak256("USD")
        ) {
            // Convert from USD to ETH
            uint256 ethPriceInUSD = usdcEthPriceFeed.latestAnswer();
            require(ethPriceInUSD > 0, "Invalid ETH price from oracle");
            return _convertToETH(assetPrice, ethPriceInUSD);
        } else {
            revert("Unsupported denomination");
        }
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
}

contract NFTPriceFeed is IPriceFeed {
    uint256 public price = 10 ether;

    function latestAnswer() external view returns (uint256) {
        return price;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }
}
