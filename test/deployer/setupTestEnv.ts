import { ethers, network } from "hardhat";
import { deployMarketplace } from "./deployMarketplace";
import { TEST_CONFIG } from "../util/testConfig";

export async function setupTestEnvironment() {
  // Deploy all contracts
  var { owner, seller, buyer, mockNFTPriceFeed, oracleHandler, marketplace, high, usdc, bayc, azuki, mockERC1155, contractAccount, simpleDAO } =
    await deployMarketplace();

  // Seller transfer voting tokens to CA
  await usdc.connect(seller).transfer(await contractAccount.getAddress(), ethers.parseUnits("1000", 18));

  // Set Oracle price feed
  const assets = [await usdc.getAddress(), await high.getAddress(), await bayc.getAddress(), await azuki.getAddress()];
  const priceFeeds = [TEST_CONFIG.PRICE_FEEDS.USDC_ETH, TEST_CONFIG.PRICE_FEEDS.HIGH_USD, mockNFTPriceFeed, mockNFTPriceFeed];
  oracleHandler = await setupOraclePriceFeed(oracleHandler, assets, priceFeeds);

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
  console.log("Contract Account ETH balance: ", await ethers.provider.getBalance(await contractAccount.getAddress()));
  console.log("DAO ETH balance: ", await ethers.provider.getBalance(await simpleDAO.getAddress()));

  // Impersonate whales and transfer tokens
  await impersonateAndTransfer(usdc, TEST_CONFIG.WHALE_ADDRESSES.USDC, TEST_CONFIG.SIGNER_ADDRESSES.SELLER, usdcInitAmount);
  await impersonateAndTransfer(high, TEST_CONFIG.WHALE_ADDRESSES.HIGH, TEST_CONFIG.SIGNER_ADDRESSES.BUYER, highInitAmount);

  // Transfer NFTs (AZUKI to buyer and BAYC to seller)
  await impersonateAndTransferNFT(azuki, TEST_CONFIG.WHALE_ADDRESSES.AZUKI, TEST_CONFIG.SIGNER_ADDRESSES.BUYER, 7737);
  await impersonateAndTransferNFT(bayc, TEST_CONFIG.WHALE_ADDRESSES.BAYC, TEST_CONFIG.SIGNER_ADDRESSES.SELLER, 2464);

  await setupAllowanceToMarketplace(marketplace, seller, buyer, usdc, high, bayc, azuki, mockERC1155);
}

async function setETHBalance(address, amount) {
  await network.provider.send("hardhat_setBalance", [address, ethers.toBeHex(amount).toString()]);
}

async function setupOraclePriceFeed(oracleHandler, assets, priceFeeds) {
  for (var i = 0; i < assets.length; i++) {
    oracleHandler.setChainlinkPriceFeed(assets[i], priceFeeds[i]);
  }
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
  console.log(`${recipient} ${token.address} balance: ${await token.balanceOf(recipient)}`);
}

async function impersonateAndTransferNFT(nftContract, whaleAddress, recipient, tokenId) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress],
  });
  const whaleSigner = await ethers.getSigner(whaleAddress);
  await nftContract.connect(whaleSigner).safeTransferFrom(whaleSigner, recipient, tokenId);
  console.log(`${recipient} ${nftContract.address} NFT tokenId ${tokenId} balance: 1`);
}

async function setupAllowanceToMarketplace(marketplace, seller, buyer, usdc, high, bayc, azuki, mockERC1155) {
  const marketplaceAddress = await marketplace.getAddress();
  const sellerAddress = await seller.getAddress();
  const buyerAddress = await buyer.getAddress();

  await usdc.connect(seller).approve(marketplaceAddress, await usdc.balanceOf(sellerAddress));
  await high.connect(buyer).approve(marketplaceAddress, await high.balanceOf(buyerAddress));

  await bayc.connect(seller).setApprovalForAll(marketplaceAddress, true);
  await azuki.connect(buyer).setApprovalForAll(marketplaceAddress, true);
  await mockERC1155.connect(seller).setApprovalForAll(marketplaceAddress, true);

  console.log(`Marketplace USDC allowance of seller: ${await usdc.allowance(sellerAddress, marketplaceAddress)}`);
  console.log(`Marketplace HIGH allowance of buyer: ${await high.allowance(buyerAddress, marketplaceAddress)}`);
}
