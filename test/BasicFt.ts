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
    baycAddress = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
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

  describe("IsERC721", function () {
    it("Should return true for ERC721", async function () {
      expect(await marketplace._isERC721(azukiAddress)).to.equal(true);
    });
    // erc20 not impl erc165(https://github.com/OpenZeppelin/openzeppelin-contracts/issues/1073)
    it("Should return false for ERC20", async function () {
      expect(await marketplace._isERC721(highAddress)).to.equal(false);
    });
  });

  // describe("ViewOrders", function () {
  //   it("Should allow user to view current orders", async function () {
  //     await setupOrders();

  //     // Check that the order is listed
  //     var listOrders = await marketplace.viewActiveOrders(1);
  //     console.log(`Listed orders: ${listOrders}\n`);
  //     expect(listOrders.length).to.equal(25);
  //     expect(listOrders[0].fulfilled).to.equal(false);
  //     expect(listOrders[1].fulfilled).to.equal(false);

  //     // Fetch next 25 orders starting from offset 2
  //     listOrders = await marketplace.viewActiveOrders(2);
  //     console.log(`Listed orders: ${listOrders}\n`);
  //     expect(listOrders.length).to.equal(25);
  //   });
  // });

  // async function setupOrders() {
  //   // List orders by seller
  //   const toSell = { asset: usdcAddress, amountOrTokenId: 10 };
  //   const toFulfill = { asset: highAddress, amountOrTokenId: 1 };
  //   const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour later

  //   // Create 10 orders
  //   for (let i = 0; i < 10; i++) {
  //     await marketplace.connect(seller).list(toSell, toFulfill, deadline);
  //   }

  //   // Fulfill 2 orders
  //   await usdc.connect(seller).approve(marketplace.getAddress(), 2000);
  //   await high.connect(buyer).approve(marketplace.getAddress(), 1000);
  //   await marketplace
  //     .connect(buyer)
  //     .fulfill(1, { value: ethers.parseEther("1") });
  //   await marketplace
  //     .connect(buyer)
  //     .fulfill(3, { value: ethers.parseEther("1") });
  // }

  describe("OracleHandler", function () {
    it("Should revert when priceFeed is the zero address in setChainlinkPriceFeed", async function () {
      const asset = ethers.ZeroAddress;
      await expect(
        oracleHandler.setChainlinkPriceFeed(asset, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid price feed address");
    });

    it("Should revert when priceFeedAddress is not set in getLatestPriceInETH", async function () {
      const asset = ethers.ZeroAddress;
      await expect(oracleHandler.getLatestPriceInETH(asset)).to.be.revertedWith(
        "Invalid price feed address"
      );
    });
  });

  describe("Withdraw", function () {
    it("Should allow the owner to withdraw platform fees", async function () {
      const marketplaceAddress = await marketplace.getAddress();
      const contractBalanceBefore = await ethers.provider.getBalance(
        marketplaceAddress
      );
      console.log(
        `Contract balance before withdrawal: ${contractBalanceBefore}`
      );
      // Check that the owner's balance increased (considering gas fees)
      const ownerBalanceBefore = await ethers.provider.getBalance(
        owner.address
      );

      console.log(`Owner balance before withdrawal: ${ownerBalanceBefore}`);

      // Withdraw funds by the owner
      await marketplace.withdraw();

      // Check that the contract's balance is now 0 after withdrawal
      const contractBalanceAfterWithdraw = await ethers.provider.getBalance(
        marketplaceAddress
      );
      console.log(
        `Contract balance after withdrawal: ${contractBalanceAfterWithdraw}`
      );
      expect(contractBalanceAfterWithdraw).to.equal(0);

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      console.log(`Owner balance after withdrawal: ${ownerBalanceAfter}`);

      // Ensure the owner's balance increased correctly by the platform fee amount minus gas
      expect(ownerBalanceAfter).to.be.above(ownerBalanceBefore);
    });

    it("Should not allow non-owners to withdraw", async function () {
      // Simulate sending some ETH as platform fees to the contract
      const platformFeeAmount = ethers.parseEther("0.5");
      const marketplaceAddress = await marketplace.getAddress();
      await buyer.sendTransaction({
        to: marketplaceAddress,
        value: platformFeeAmount,
      });

      // Try to call withdraw from a non-owner account
      await expect(marketplace.connect(buyer).withdraw()).to.be.revertedWith(
        "Only owner can call this function"
      );
    });

    it("Should revert if there is no balance to withdraw", async function () {
      // withdraw funds by the owner first
      marketplace.withdraw();
      // Try to call withdraw the second time
      await expect(marketplace.withdraw()).to.be.revertedWith(
        "No balance to withdraw"
      );
    });
  });
});
