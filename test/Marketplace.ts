import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Marketplace, OracleHandler, NFTPriceFeed } from "../typechain-types";
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
  let owner: any;
  let seller: any;
  let buyer: any;
  let high: any;
  let usdc: any;
  let bayc: any;
  let azuki: any;
  let sellerAddress: AddressLike;
  let buyerAddress: AddressLike;
  let highAddress: AddressLike;
  let usdcAddress: AddressLike;
  let baycAddress: AddressLike;
  let azukiAddress: AddressLike;
  const USDC_ETH_PRICEFEED_ADDRESS: AddressLike =
    "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
  const USDT_ETH_PRICEFEED_ADDRESS: AddressLike =
    "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";
  const HIGH_USD_PRICEFEED_ADDRESS: AddressLike =
    "0x5C8D8AaB4ffa4652753Df94f299330Bb4479bF85";

  const ethInitAmount = ethers.parseEther("100");
  const usdcInitAmount = ethers.parseUnits("1000", 6);
  const highInitAmount = ethers.parseUnits("1000", 18);

  // Deploy fixtures
  beforeEach(async function () {
    await loadFixture(deployMarketplaceFixture);
    await loadFixture(deployOracleHandlerFixture);
    await loadFixture(initializeTokenAmountFixture);
  });

  async function deployMarketplaceFixture() {
    // Get the signers
    [owner, seller, buyer] = await ethers.getSigners();
    console.log("owner: ", owner.address);
    console.log("seller: ", seller.address);
    console.log("buyer: ", buyer.address);
    // Address
    sellerAddress = await seller.getAddress();
    buyerAddress = await buyer.getAddress();

    // Deploy OracleHandler
    const OracleHandler = await ethers.getContractFactory("OracleHandler");
    oracleHandler = await OracleHandler.deploy(USDC_ETH_PRICEFEED_ADDRESS);

    // Fork erc20
    highAddress = "0x71ab77b7dbb4fa7e017bc15090b2163221420282";
    usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    high = await ethers.getContractAt("IERC20", highAddress);

    // Fork erc721
    baycAddress = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"; //Unknown: 0xe2A83b15FC300D8457eB9E176f98d92a8FF40a49
    azukiAddress = "0xed5af388653567af2f388e6224dc7c4b3241c544";
    bayc = await ethers.getContractAt("IERC721", baycAddress);
    azuki = await ethers.getContractAt("IERC721", azukiAddress);

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(oracleHandler.getAddress());

    // Deploy NFTPriceFeed
    const NFTPriceFeed = await ethers.getContractFactory("NFTPriceFeed");
    nftPriceFeed = await NFTPriceFeed.deploy();
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
    await usdc.connect(usdcWhale).transfer(buyerAddress, usdcInitAmount);

    // Impersonate a High holder with a large balance (whale)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [highWhaleAddress],
    });

    const highWhale = await ethers.getSigner(highWhaleAddress);
    await high.connect(highWhale).transfer(buyerAddress, highInitAmount);

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
  describe("Initialize", function () {
    it("Should transfer ETH to buyer account", async () => {
      const finalBalance = await ethers.provider.getBalance(buyerAddress);
      console.log(`Final ETH balance: ${finalBalance}`);
      expect(finalBalance).to.equal(ethInitAmount);
    });
    it("Should transfer ETH to seller account", async () => {
      const finalBalance = await ethers.provider.getBalance(sellerAddress);
      console.log(`Final ETH balance: ${finalBalance}`);
      expect(finalBalance).to.equal(ethInitAmount);
    });

    it("Should transfer USDC from whale to seller", async () => {
      const finalBalance = await usdc.balanceOf(buyerAddress);
      console.log(`Final USDC balance: ${finalBalance}`);
      expect(finalBalance).to.equal(usdcInitAmount);
    });

    it("Should transfer HIGH from whale to buyer", async () => {
      const finalBalance = await high.balanceOf(buyerAddress);
      console.log(`Final HIGH balance: ${finalBalance}`);
      expect(finalBalance).to.equal(highInitAmount);
    });

    it("Should transfer AZUKI from whale to buyer", async () => {
      const finalBalance = await azuki.balanceOf(buyerAddress);
      console.log(`Final ERC721 balance: ${finalBalance}`);
      expect(finalBalance).to.equal(1);
    });

    it("Should transfer BAYC from whale to seller", async () => {
      const finalBalance = await bayc.balanceOf(sellerAddress);
      console.log(`Final ERC721 balance: ${finalBalance}`);
      expect(finalBalance).to.equal(1);
    });
  });
  describe("Listing Orders", function () {
    it("Should allow seller to list an ERC20 for sale", async function () {
      const toSell = { asset: usdcAddress, amountOrTokenId: 100 };
      const toFulfill = { asset: highAddress, amountOrTokenId: 10 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);
      const listedOrder = await marketplace.orders(1);
      //console.log("ERC20 listedOrder: ", listedOrder);
      expect(listedOrder.seller).to.equal(seller.address);
    });

    it("Should allow seller to list an ERC721 for sale", async function () {
      const toSell = { asset: baycAddress, amountOrTokenId: 1 };
      const toFulfill = { asset: azukiAddress, amountOrTokenId: 2 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);
      const listedOrder = await marketplace.orders(1);
      //console.log("ERC721 listedOrder: ", listedOrder);
      expect(listedOrder.seller).to.equal(seller.address);
      //console.log("ERC721 listedOrder: ", listedOrder);
    });
    // TODO: OrderCreated event emit.WithArgs not equal issue
    // it("Should emit OrderCreated event when listing an order", async function () {
    //   const order = {
    //     eid: 0,
    //     seller: sellerAddress,
    //     buyer: ethers.ZeroAddress,
    //     toSell: { asset: usdcAddress, amountOrTokenId: 100 },
    //     toFulfill: { asset: highAddress, amountOrTokenId: 10 },
    //     fulfilled: false,
    //     deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
    //   };
    //   //   console.log("test order: ", order);
    //   //   console.log("order.toSell", order.toSell);
    //   //   console.log("order.toFulfill", order.toFulfill);
    //   await expect(marketplace.connect(seller).list(order))
    //     .to.emit(marketplace, "OrderCreated")
    //     .withArgs(0, seller.address, order.toSell, order.toFulfill);
    // });
  });
  describe("Cancelling Orders", function () {
    it("Should allow seller to cancel their own order", async function () {
      // Seller lists an order
      const toSell = { asset: usdcAddress, amountOrTokenId: 100 };
      const toFulfill = { asset: highAddress, amountOrTokenId: 10 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);

      // Seller cancels their order
      //console.log("before cancel order: ", await marketplace.orders(1));
      await marketplace.connect(seller).cancel(1);
      //console.log("after cancel order: ", await marketplace.orders(1));
      const canceledOrder = await marketplace.orders(1);
      expect(canceledOrder.eid).to.equal(0);
    });

    it("Should not allow others to cancel the order", async function () {
      // Seller lists an order
      const toSell = { asset: usdcAddress, amountOrTokenId: 100 };
      const toFulfill = { asset: highAddress, amountOrTokenId: 10 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later

      await marketplace.connect(seller).list(toSell, toFulfill, deadline);

      // Try to cancel the order as a different user
      await expect(marketplace.connect(buyer).cancel(1)).to.be.revertedWith(
        "Only seller can cancel"
      );
    });
  });

  describe("IsERC721", function () {
    it("Should return true for ERC721", async function () {
      expect(await marketplace._isERC721(azukiAddress)).to.equal(true);
    });
    // erc20 not impl erc165(https://github.com/OpenZeppelin/openzeppelin-contracts/issues/1073)
    it("Should return false for ERC20", async function () {
      expect(await marketplace._isERC721(highAddress)).to.equal(false);
    });
  });

  // TODO:Edge Case
  //1. Think about the asset was transferred to others before the Order fulfilled
  //2. list(needed data)
  describe("Fulfilling Orders", function () {
    it("Should allow buyer to fulfill an ERC20 order", async function () {
      // List order by seller
      const toSell = { asset: usdcAddress, amountOrTokenId: 100 };
      const toFulfill = { asset: highAddress, amountOrTokenId: 10 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);

      // Approve allowance to fulfill the order
      await usdc.connect(seller).approve(marketplace.getAddress(), 100);
      await high.connect(buyer).approve(marketplace.getAddress(), 10);

      // Fulfill the order, buyer should know the fee offchain
      await marketplace
        .connect(buyer)
        .fulfill(1, { value: ethers.parseEther("11") });

      // Check that the order is fulfilled
      const fulfilledOrder = await marketplace.orders(1);
      expect(fulfilledOrder.fulfilled).to.equal(true);
    });

    it("Should not allow fulfilling ERC20 with insufficient ETH for fee", async function () {
      // List order by seller
      const toSell = { asset: usdcAddress, amountOrTokenId: 100 };
      const toFulfill = { asset: highAddress, amountOrTokenId: 10 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);

      // Approve allowance to fulfill the order
      await usdc.connect(seller).approve(marketplace.getAddress(), 100);
      await high.connect(buyer).approve(marketplace.getAddress(), 10);

      // Try to fulfill the order with insufficient ETH for the platform fee
      await expect(
        marketplace.connect(buyer).fulfill(1, { value: 1 })
      ).to.be.revertedWith("Insufficient ETH for platform fee");
    });

    it("Should allow user to view current orders", async function () {
      // List order by seller
      const toSell = { asset: usdcAddress, amountOrTokenId: 100 };
      const toFulfill = { asset: highAddress, amountOrTokenId: 10 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);
      // Check that the order is listed
      const listOrders = await marketplace.viewOrders();
      console.log("View all orders: ", listOrders);
      expect(listOrders.length).to.equal(1);
    });

    it("Should allow buyer to fulfill an ERC721 order", async function () {
      // List order by seller
      const toSell = { asset: baycAddress, amountOrTokenId: 2464 };
      const toFulfill = { asset: azukiAddress, amountOrTokenId: 7737 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);

      // Approve allowance to fulfill the order
      const marketplaceAddress = marketplace.getAddress();
      await azuki.connect(buyer).approve(marketplaceAddress, 7737);
      await bayc.connect(seller).approve(marketplaceAddress, 2464);

      // Fulfill the order by buyer, buyer should know the fee offchain
      await marketplace
        .connect(buyer)
        .fulfill(1, { value: ethers.parseEther("0.5") });

      // Check that the order is fulfilled
      const fulfilledOrder = await marketplace.orders(1);
      expect(fulfilledOrder.fulfilled).to.equal(true);
    });

    it("Should not allow fulfilling ERC721 with insufficient ETH for fee", async function () {
      // List order by seller
      const toSell = { asset: baycAddress, amountOrTokenId: 2464 };
      const toFulfill = { asset: azukiAddress, amountOrTokenId: 7737 };
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later
      await marketplace.connect(seller).list(toSell, toFulfill, deadline);

      // Approve allowance to fulfill the order
      const marketplaceAddress = marketplace.getAddress();
      await azuki.connect(buyer).approve(marketplaceAddress, 7737);
      await bayc.connect(seller).approve(marketplaceAddress, 2464);

      // Try to fulfill the order with insufficient ETH for the platform fee
      await expect(
        marketplace.connect(buyer).fulfill(1, { value: 1 })
      ).to.be.revertedWith("Insufficient ETH for platform fee");
    });

    // exchange ERC721 for ERC20
  });
});
