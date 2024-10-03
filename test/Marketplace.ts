import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Marketplace, OracleHandler } from "../typechain-types";
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
  beforeEach(async function () {
    await loadFixture(deployMarketplaceFixture);
    await loadFixture(deployOracleHandlerFixture);
  });

  async function deployMarketplaceFixture() {
    // Get the signers
    [owner, seller, buyer] = await ethers.getSigners();
    console.log("owner: ", owner.address);
    console.log("seller: ", seller.address);
    console.log("buyer: ", buyer.address);
    // Address
    sellerAddress = await seller.address;
    buyerAddress = await buyer.address;

    // Deploy OracleHandler
    const OracleHandler = await ethers.getContractFactory("OracleHandler");
    oracleHandler = await OracleHandler.deploy(USDC_ETH_PRICEFEED_ADDRESS);

    // Fork erc20
    highAddress = "0x71ab77b7dbb4fa7e017bc15090b2163221420282";
    usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    high = await ethers.getContractAt("IERC20", highAddress);

    // Fork erc721
    baycAddress = "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";
    azukiAddress = "0xed5af388653567af2f388e6224dc7c4b3241c544";
    bayc = await ethers.getContractAt("IERC721", baycAddress);
    azuki = await ethers.getContractAt("IERC721", azukiAddress);

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(oracleHandler.getAddress());

    // Initial amounts
    const HUNDRED_ETH = ethers.parseEther("100");
    const HUNDERE_USDC = 100 * 1e6;

    await network.provider.send("hardhat_setBalance", [
      buyer.address,
      ethers.toBeHex(HUNDRED_ETH).toString(),
    ]);

    // TODO: Initial amounts for ERC20
    // Seller
    // Buyer

    // TODO: Initial amounts for ERC721
    // Seller
    // Buyer

    //Check
    console.log(
      "buyer eth balance: ",
      await ethers.provider.getBalance(buyer.address)
    );
    console.log("buyer usdc balance: ", usdc.balanceOf(buyer.address));
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
  }

  describe("Listing Orders", function () {
    it("Should allow seller to list an ERC20 for sale", async function () {
      const order = {
        eid: 0,
        seller: sellerAddress,
        buyer: ethers.ZeroAddress,
        toSell: { asset: usdcAddress, amountOrTokenId: 100 },
        toFulfill: { asset: highAddress, amountOrTokenId: 10 },
        fulfilled: false,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
      };

      await marketplace.connect(seller).list(order);

      const listedOrder = await marketplace.orders(1);
      expect(listedOrder.seller).to.equal(seller.address);
    });

    it("Should allow seller to list an ERC721 for sale", async function () {
      const order = {
        eid: 0,
        seller: sellerAddress,
        buyer: ethers.ZeroAddress,
        toSell: { asset: baycAddress, amountOrTokenId: 1 },
        toFulfill: { asset: azukiAddress, amountOrTokenId: 2 },
        fulfilled: false,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
      };

      await marketplace.connect(seller).list(order);
      const listedOrder = await marketplace.orders(1);
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
      const order = {
        eid: 0,
        seller: sellerAddress,
        buyer: ethers.ZeroAddress,
        toSell: { asset: usdcAddress, amountOrTokenId: 100 },
        toFulfill: { asset: highAddress, amountOrTokenId: 10 },
        fulfilled: false,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
      };

      await marketplace.connect(seller).list(order);

      // Seller cancels their order
      //console.log("before cancel order: ", await marketplace.orders(1));
      await marketplace.connect(seller).cancel(1);
      //console.log("after cancel order: ", await marketplace.orders(1));
      const canceledOrder = await marketplace.orders(1);
      expect(canceledOrder.eid).to.equal(0);
    });

    it("Should not allow others to cancel the order", async function () {
      const order = {
        eid: 0,
        seller: sellerAddress,
        buyer: ethers.ZeroAddress,
        toSell: { asset: usdcAddress, amountOrTokenId: 100 },
        toFulfill: { asset: highAddress, amountOrTokenId: 10 },
        fulfilled: false,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
      };

      await marketplace.connect(seller).list(order);

      // Try to cancel the order as a different user
      await expect(marketplace.connect(buyer).cancel(1)).to.be.revertedWith(
        "Only seller can cancel"
      );
    });
  });

  describe("IsERC721", function () {
    it("Should return true for ERC721", async function () {
      console.log("--------flag------");
      //console.log("is erc721: ", await marketplace._isERC721(azukiAddress));

      expect(await marketplace._isERC721(azukiAddress)).to.equal(true);
    });
    // erc20 not impl erc165(https://github.com/OpenZeppelin/openzeppelin-contracts/issues/1073)
    it("Should return false for ERC20", async function () {
      expect(await marketplace._isERC721(highAddress)).to.equal(false);
    });
  });

  describe("Fulfilling Orders", function () {
    it("Should allow buyer to fulfill an ERC20 order", async function () {
      // List order by seller
      const order = {
        eid: 0,
        seller: sellerAddress,
        buyer: ethers.ZeroAddress,
        toSell: { asset: usdcAddress, amountOrTokenId: 100 },
        toFulfill: { asset: highAddress, amountOrTokenId: 10 },
        fulfilled: false,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
      };

      await marketplace.connect(seller).list(order);

      // Approve buyer to fulfill the order
      await high.connect(buyer).approve(marketplace.getAddress(), 10);

      // Fulfill the order, buyer should know the fee offchain
      await marketplace
        .connect(buyer)
        .fulfill(1, { value: ethers.parseEther("11") });

      const fulfilledOrder = await marketplace.orders(1);
      expect(fulfilledOrder.fulfilled).to.equal(true);
    });

    it("Should not allow fulfilling with insufficient ETH for fee", async function () {
      // List order by seller
      const order = {
        eid: 0,
        seller: sellerAddress,
        buyer: ethers.ZeroAddress,
        toSell: { asset: usdcAddress, amountOrTokenId: 100 },
        toFulfill: { asset: highAddress, amountOrTokenId: 10 },
        fulfilled: false,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour later
      };

      await marketplace.connect(seller).list(order);

      // Approve buyer to fulfill the order
      await high.connect(buyer).approve(marketplace.getAddress(), 10);

      // Try to fulfill the order with insufficient ETH for the platform fee
      await expect(
        marketplace
          .connect(buyer)
          .fulfill(1, { value: ethers.parseEther("0.00000005") })
      ).to.be.revertedWith("Insufficient ETH for platform fee");
    });
  });
});
