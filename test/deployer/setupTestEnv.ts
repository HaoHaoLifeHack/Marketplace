import { ethers, network } from "hardhat";
import { deployMarketplace } from "./deployMarketplace";
import { TEST_CONFIG } from "../util/testConfig";
import { IERC1155, IPriceFeed, OracleHandler, WETH } from "../../typechain-types";

export async function setupTestEnvironment() {
  // Deploy all contracts
  var { owner, seller, buyer, mockNFTPriceFeed, oracleHandler, marketplace, high, usdc, weth, bayc, azuki, mockERC1155, contractAccount, simpleDAO } =
    await deployMarketplace();

  // Set Oracle price feed
  oracleHandler = await setupOraclePriceFeed(oracleHandler, await mockNFTPriceFeed.getAddress(), await mockERC1155.getAddress());

  // Initial ETH amounts setup
  const initAddresses = [
    TEST_CONFIG.SIGNER_ADDRESSES.BUYER,
    TEST_CONFIG.SIGNER_ADDRESSES.SELLER,
    TEST_CONFIG.WHALE_ADDRESSES.USDC,
    TEST_CONFIG.WHALE_ADDRESSES.HIGH,
  ];

  for (const address of initAddresses) {
    await setETHBalance(address, ethers.parseEther("100"));
  }

  // Log contract account and DAO balance
  const usdcInitAmount = ethers.parseUnits("1000", 6);
  const highInitAmount = ethers.parseUnits("1000", 18);

  // Impersonate whales and transfer tokens
  await impersonateAndTransfer(usdc, TEST_CONFIG.WHALE_ADDRESSES.USDC, TEST_CONFIG.SIGNER_ADDRESSES.SELLER, usdcInitAmount);
  await impersonateAndTransfer(high, TEST_CONFIG.WHALE_ADDRESSES.HIGH, TEST_CONFIG.SIGNER_ADDRESSES.BUYER, highInitAmount);

  // Transfer NFTs (AZUKI to buyer and BAYC to seller)
  await impersonateAndTransferNFT(azuki, TEST_CONFIG.WHALE_ADDRESSES.AZUKI, TEST_CONFIG.SIGNER_ADDRESSES.BUYER, 7737);
  await impersonateAndTransferNFT(bayc, TEST_CONFIG.WHALE_ADDRESSES.BAYC, TEST_CONFIG.SIGNER_ADDRESSES.SELLER, 2464);

  // Transfer ERC1155 to buyer
  await impersonateAndTransferERC1155(mockERC1155, TEST_CONFIG.SIGNER_ADDRESSES.SELLER, TEST_CONFIG.SIGNER_ADDRESSES.BUYER, 0, 100);
  await impersonateAndTransferERC1155(mockERC1155, TEST_CONFIG.SIGNER_ADDRESSES.SELLER, TEST_CONFIG.SIGNER_ADDRESSES.BUYER, 1, 1000);

  // Buyer deposit ETH
  await weth.connect(buyer).deposit({ value: ethers.parseEther("10") });

  // Seller transfer voting tokens to CA
  await usdc.connect(seller).transfer(await contractAccount.getAddress(), ethers.parseUnits("100", 6));

  await setupAllowanceToMarketplace(marketplace, seller, buyer, usdc, high, weth, bayc, azuki, mockERC1155);
  return {
    owner,
    seller,
    buyer,
    oracleHandler,
    mockNFTPriceFeed,
    marketplace,
    high,
    usdc,
    weth,
    bayc,
    azuki,
    mockERC1155,
    contractAccount,
    simpleDAO,
  };
}

export async function setETHBalance(address, amount) {
  await network.provider.send("hardhat_setBalance", [address, ethers.toBeHex(amount).toString()]);
}

async function setupOraclePriceFeed(oracleHandler, nftPriceFeed, mockERC1155Address) {
  const assets = [
    TEST_CONFIG.TOKEN_ADDRESSES.USDC,
    TEST_CONFIG.TOKEN_ADDRESSES.HIGH,
    TEST_CONFIG.TOKEN_ADDRESSES.BAYC,
    TEST_CONFIG.TOKEN_ADDRESSES.AZUKI,
    mockERC1155Address,
  ];
  const priceFeeds = [TEST_CONFIG.PRICE_FEEDS.USDC_ETH, TEST_CONFIG.PRICE_FEEDS.HIGH_USD, nftPriceFeed, nftPriceFeed, nftPriceFeed];
  const isDenoteByETHs = [true, false, true, true, true];
  for (var i = 0; i < assets.length; i++) {
    await oracleHandler.setChainlinkPriceFeed(assets[i], priceFeeds[i], isDenoteByETHs[i]);
  }
  console.log();
  return oracleHandler;
}

async function impersonateAndTransfer(token, whaleAddress, recipient, amount) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress],
  });
  const whaleSigner = await ethers.getSigner(whaleAddress);

  const initBalance = await token.balanceOf(recipient);
  const transferAmount = initBalance !== 0 ? amount - initBalance : amount;

  await token.connect(whaleSigner).transfer(recipient, transferAmount);
  const tokenAddress = await token.getAddress();
  //console.log(`${recipient} ${tokenAddress} balance: ${await token.balanceOf(recipient)}`);
}

async function impersonateAndTransferNFT(nftContract, whaleAddress, recipient, tokenId) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress],
  });
  const whaleSigner = await ethers.getSigner(whaleAddress);
  await nftContract.connect(whaleSigner).safeTransferFrom(whaleAddress, recipient, tokenId);
  const nftAddress = await nftContract.getAddress();
  //console.log(`${recipient} ${nftAddress} NFT tokenId ${tokenId} balance: ${await nftContract.balanceOf(recipient)}`);
}

async function impersonateAndTransferERC1155(erc1155Contract: IERC1155, whaleAddress, recipient, id, amountOrTokenId) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress],
  });
  const whaleSigner = await ethers.getSigner(whaleAddress);
  await erc1155Contract.connect(whaleSigner).safeTransferFrom(whaleAddress, recipient, id, amountOrTokenId, "0x");
}

async function setupAllowanceToMarketplace(marketplace, seller, buyer, usdc, high, weth, bayc, azuki, mockERC1155) {
  const marketplaceAddress = await marketplace.getAddress();
  const sellerAddress = await seller.getAddress();
  const buyerAddress = await buyer.getAddress();

  await usdc.connect(seller).approve(marketplaceAddress, await usdc.balanceOf(sellerAddress));
  await high.connect(buyer).approve(marketplaceAddress, await high.balanceOf(buyerAddress));
  await weth.connect(buyer).approve(marketplaceAddress, await weth.balanceOf(buyerAddress));

  await bayc.connect(seller).setApprovalForAll(marketplaceAddress, true);
  await azuki.connect(buyer).setApprovalForAll(marketplaceAddress, true);
  await mockERC1155.connect(seller).setApprovalForAll(marketplaceAddress, true);
  await mockERC1155.connect(buyer).setApprovalForAll(marketplaceAddress, true);

  // console.log(`Marketplace USDC allowance of seller: ${await usdc.allowance(sellerAddress, marketplaceAddress)}`);
  // console.log(`Marketplace HIGH allowance of buyer: ${await high.allowance(buyerAddress, marketplaceAddress)}`);
  // console.log(`Marketplace WETH allowance of buyer: ${await weth.allowance(buyerAddress, marketplaceAddress)}`);
}
