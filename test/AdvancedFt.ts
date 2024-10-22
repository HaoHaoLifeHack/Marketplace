import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  Marketplace,
  OracleHandler,
  NFTPriceFeed,
  DAO,
} from "../typechain-types";
import {
  erc20,
  erc721,
} from "../typechain-types/@openzeppelin/contracts/token";
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IERC721 } from "../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
import { AddressLike } from "ethers";
import { boolean } from "hardhat/internal/core/params/argumentTypes";

describe("Marketplace Contract", function () {
  let marketplace: Marketplace;
  let oracleHandler: OracleHandler;
  let nftPriceFeed: NFTPriceFeed;
  let high: any;
  let usdc: any;
  let bayc: any;
  let azuki: any;
  let sellerAddress: AddressLike;
  let sellerWallet: any;
  let sellerSignature: any;
  let buyerAddress: AddressLike;
  let buyerWallet: any;
  let highAddress: AddressLike;
  let usdcAddress: AddressLike;
  let baycAddress: AddressLike;
  let azukiAddress: AddressLike;
  let offchainOrderHash: any;
  const USDC_ETH_PRICEFEED_ADDRESS: AddressLike =
    "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
  const USDT_ETH_PRICEFEED_ADDRESS: AddressLike =
    "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";
  const HIGH_USD_PRICEFEED_ADDRESS: AddressLike =
    "0x5C8D8AaB4ffa4652753Df94f299330Bb4479bF85";

  const ethInitAmount = ethers.parseEther("100");
  const usdcInitAmount = ethers.parseUnits("1000", 6);
  const highInitAmount = ethers.parseUnits("1000", 18);
  let offchainOrder: any;

  // Deploy fixtures
  beforeEach(async function () {
    await loadFixture(deployMarketplaceFixture);
    await loadFixture(deployOracleHandlerFixture);
    await loadFixture(initializeTokenAmountFixture);
    await loadFixture(offchainSignedDataFixture);
  });

  async function deployMarketplaceFixture() {
    // Define the test wallet
    const sellerPrivateKey =
      "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e"; // Account#19: 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
    sellerWallet = new ethers.Wallet(sellerPrivateKey);

    const buyerPrivateKey =
      "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0"; // Account#18: 0xdD2FD4581271e230360230F9337D5c0430Bf44C0
    buyerWallet = new ethers.Wallet(buyerPrivateKey);
    console.log("seller address:", sellerWallet.address);
    console.log("buyer address:", buyerWallet.address);

    // Address
    sellerAddress = await sellerWallet.address;
    buyerAddress = await buyerWallet.address;

    // Deploy OracleHandler
    const OracleHandler = await ethers.getContractFactory("OracleHandler");
    oracleHandler = await OracleHandler.deploy(USDC_ETH_PRICEFEED_ADDRESS, {
      gasLimit: 30000000,
      maxFeePerGas: ethers.parseUnits("20000", "gwei"), // Set higher maxFeePerGas
      //   maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"), // Set a priority fee
    });

    // Fork erc20
    highAddress = "0x71ab77b7dbb4fa7e017bc15090b2163221420282";
    usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    high = await ethers.getContractAt("IERC20", highAddress);

    // Fork erc721
    baycAddress = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
    azukiAddress = "0xed5af388653567af2f388e6224dc7c4b3241c544";
    bayc = await ethers.getContractAt("IERC721", baycAddress);
    azuki = await ethers.getContractAt("IERC721", azukiAddress);

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(oracleHandler.getAddress(), {
      gasLimit: 30000000,
      maxFeePerGas: ethers.parseUnits("20000", "gwei"), // Set higher maxFeePerGas
      //   maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"), // Set a priority fee
    });

    // Deploy NFTPriceFeed
    const NFTPriceFeed = await ethers.getContractFactory("NFTPriceFeed");
    nftPriceFeed = await NFTPriceFeed.deploy({
      gasLimit: 30000000,
      maxFeePerGas: ethers.parseUnits("20000", "gwei"), // Set higher maxFeePerGas
      //   maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"), // Set a priority fee
    });
  }
  async function deployOracleHandlerFixture() {
    oracleHandler.setChainlinkPriceFeed(
      usdcAddress,
      USDT_ETH_PRICEFEED_ADDRESS
    );
    oracleHandler.setChainlinkPriceFeed(
      highAddress,
      HIGH_USD_PRICEFEED_ADDRESS
    );
    oracleHandler.setChainlinkPriceFeed(
      azukiAddress,
      nftPriceFeed.getAddress()
    );
    oracleHandler.setChainlinkPriceFeed(baycAddress, nftPriceFeed.getAddress());
  }
  async function initializeTokenAmountFixture() {
    // Mainnet Whale
    const usdcWhaleAddress = "0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341";
    const highWhaleAddress = "0xd16e3CB8Dc662e975570aE8b49065Fa0AECb0bdA";

    //Initial ETH amounts
    await network.provider.send("hardhat_setBalance", [
      buyerAddress,
      ethers.toBeHex(ethInitAmount).toString(),
    ]);
    await network.provider.send("hardhat_setBalance", [
      sellerAddress,
      ethers.toBeHex(ethInitAmount).toString(),
    ]);
    await network.provider.send("hardhat_setBalance", [
      usdcWhaleAddress,
      ethers.toBeHex(ethInitAmount).toString(),
    ]);
    await network.provider.send("hardhat_setBalance", [
      highWhaleAddress,
      ethers.toBeHex(ethInitAmount).toString(),
    ]);
    const marketplaceAddress = await marketplace.getAddress();
    await network.provider.send("hardhat_setBalance", [
      marketplaceAddress,
      ethers.toBeHex(ethInitAmount).toString(),
    ]);

    // Impersonate a USDC holder with a large balance (whale)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhaleAddress],
    });
    const usdcWhale = await ethers.getSigner(usdcWhaleAddress);

    // Check initial USDC balance of test account
    const initSellerBalance = await usdc.balanceOf(sellerAddress);
    initSellerBalance != 0
      ? await usdc
          .connect(usdcWhale)
          .transfer(sellerAddress, usdcInitAmount - initSellerBalance)
      : await usdc.connect(usdcWhale).transfer(sellerAddress, usdcInitAmount);

    // Impersonate a High holder with a large balance (whale)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [highWhaleAddress],
    });
    const highWhale = await ethers.getSigner(highWhaleAddress);

    // Check initial High balance of test account
    const initHighBalance = await high.balanceOf(buyerAddress);
    initHighBalance != 0
      ? await high
          .connect(highWhale)
          .transfer(buyerAddress, highInitAmount - initHighBalance)
      : await high.connect(highWhale).transfer(buyerAddress, highInitAmount);

    // Buyer need AZUKI
    // Seller need BAYC
    // Transfer ERC721 tokens to seller and buyer
    const azukiWhaleAddress = "0x5D7aAa862681920Ea4f350a670816b0977c80B37";
    const baycWhaleAddress = "0xe3199072644455D19f58B1fd8106Ac80b3d2e780";

    // Impersonate a AZUKI holder with a large balance (whale)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [azukiWhaleAddress],
    });

    const azukiWhale = await ethers.getSigner(azukiWhaleAddress);
    await azuki
      .connect(azukiWhale)
      .safeTransferFrom(azukiWhale, buyerAddress, 7737);

    // Impersonate a BAYC holder with a large balance (whale)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [baycWhaleAddress],
    });
    const baycWhale = await ethers.getSigner(baycWhaleAddress);
    await bayc
      .connect(baycWhale)
      .safeTransferFrom(baycWhale, sellerAddress, 2464);
  }

  async function offchainSignedDataFixture() {
    // Test low-level calldata
    const proposalId = 1;
    const amount = 10;
    const externalCalldata = marketplace.interface.encodeFunctionData("test", [
      proposalId,
      amount,
    ]);

    console.log("offchain-gen trigger external calldata:", externalCalldata);

    // Define the order data
    offchainOrder = {
      eid: 1,
      buyer: buyerAddress,
      seller: sellerAddress,
      toSell: {
        daoAddress: sellerAddress,
        data: externalCalldata,
      },
      toFulfill: {
        asset: "0x71ab77b7dbb4fa7e017bc15090b2163221420282", // high
        amountOrTokenId: 10, // Amount (ERC20) or Token ID (ERC721)
      },
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiration
      fulfilled: false,
    };

    // Create the order hash to sign
    offchainOrderHash = await marketplace.getOrderHash(offchainOrder);
    console.log("Order Hash:", offchainOrderHash);

    // Call the function to sign the order
    sellerSignature = await signOrder(sellerWallet, offchainOrderHash);
  }
  describe("Cancel order", function () {
    it("Should cancel order", async function () {
      const receipt = await cancelOrder(offchainOrder, sellerSignature);
      //console.log("Receipt:", receipt);

      expect(await marketplace.cancelOrders(offchainOrderHash)).to.be.true;
    });

    it("Should emit OrderCancelled event when an order is cancelled", async function () {
      const result = await cancelOrder(offchainOrder, sellerSignature);
      console.log("Cancel Result:", result);

      await expect(marketplace.cancelOrders(offchainOrderHash))
        .to.emit(marketplace, "OrderCancelled")
        .withArgs(offchainOrderHash); // Check that the event is emitted with the correct argument
    });
  });
  // Call the contract's cancel function
  async function cancelOrder(order: any, sellerSignature: any) {
    const tx = await marketplace.cancelOrder(order, sellerSignature);

    console.log("Transaction hash:", tx.hash);
    await tx.wait(); // Wait for the transaction to be mined
    console.log("Order cancelled!");
    return tx;
  }

  describe("Off-chain sign & On-chain fulfill", function () {
    it("Should verify on-chain", async function () {
      // Raw order
      //console.log("Raw Order Data:", offchainOrder);

      // Call the contract's fulfillOffchainOrder function
      const receipt = await fulfillOrder(offchainOrder, sellerSignature);
      //console.log("Receipt:", receipt);
    });
  });

  // Call the contract's fulfillOffchainOrder function
  async function fulfillOrder(order: any, sellerSignature: any) {
    await setupAllowance();
    const tx = await marketplace.fulfillOffchainOrder(order, sellerSignature, {
      value: ethers.parseEther("0.1"), // Example value for payment
    });

    console.log("Transaction hash:", tx.hash);
    await tx.wait(); // Wait for the transaction to be mined
    console.log("Order fulfilled!");
    return tx;
  }
  // Sign the order hash with the seller's private key
  async function signOrder(wallet: any, orderHash: any) {
    const signature = await wallet.signMessage(ethers.toBeArray(orderHash));
    console.log("Signed Order Signature:", signature);
    return signature;
  }

  async function setupAllowance() {
    await usdc
      .connect(await ethers.getSigner(sellerWallet.address))
      .approve(marketplace.getAddress(), 1000);
    await high
      .connect(await ethers.getSigner(buyerWallet.address))
      .approve(marketplace.getAddress(), 1000);
  }
});
