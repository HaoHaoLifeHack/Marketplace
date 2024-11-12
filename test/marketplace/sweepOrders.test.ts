import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMarketplace } from "../deployer/deployMarketplace";
import { setupTestEnvironment } from "../deployer/setupTestEnv";
import { getOrderSignature, getOrderBasicHash } from "../util/signature";
import { Marketplace, OracleHandler, NFTPriceFeed, ContractAccount, SimpleDAO, GameItems, IPriceFeed } from "../../typechain-types";
import { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IERC721 } from "../../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
import { IERC1155 } from "../../typechain-types/@openzeppelin/contracts/token/ERC1155/IERC1155";
import { getOrderHash } from "../util/signature";
import { getFunctionTriggerCalldata, getBasicOrder } from "../util/helpers";
import { generateMerkleTree, searchProof } from "../util/merkleTree";
import { getProof } from "@openzeppelin/merkle-tree/dist/core";
import { TEST_CONFIG } from "../util/testConfig";

describe("Sweep order", function () {
  let seller: any,
    buyer: any,
    usdc: IERC20,
    high: IERC20,
    azuki: IERC721,
    bayc: IERC721,
    mockERC1155: IERC1155,
    marketplace: Marketplace,
    oracleHandler: OracleHandler,
    mockNFTPriceFeed: IPriceFeed;
  let offchainOrder: any;
  let sellerSignature: any;
  let offchainOrderHash: any;
  let offchainBasicOrders: any;
  let offchainBasicSignatures = [];
  let offchainERC20Orders: any;
  let offchainERC20Signatures = [];

  beforeEach(async () => {
    ({ seller, buyer, oracleHandler, marketplace, high, usdc, bayc, azuki, mockERC1155, mockNFTPriceFeed } = await setupTestEnvironment());

    // Prepare an basic order
    const toSell = { asset: TEST_CONFIG.TOKEN_ADDRESSES.USDC, ids: [0], amountOrTokenIds: [100] };
    const toFulfill = { asset: TEST_CONFIG.TOKEN_ADDRESSES.HIGH, ids: [0], amountOrTokenIds: [10] };
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Prepare offchain order, signature, and hash for both tests
    offchainOrder = getBasicOrder(TEST_CONFIG.SIGNER_ADDRESSES.BUYER, TEST_CONFIG.SIGNER_ADDRESSES.SELLER, toSell, toFulfill, deadline, false);
    offchainOrderHash = getOrderBasicHash(offchainOrder);
    const signer = TEST_CONFIG.SIGNER_ADDRESSES.SELLER;
    sellerSignature = await getOrderSignature(offchainOrder, signer);
  });

  it.only("Should sweep multiple basic orders combined with ERC721 or ERC1155 by sweepOrders", async function () {
    // Set up diverse orders
    const isOnlyERC20 = false;
    offchainBasicOrders = await setupDiverseOrders(isOnlyERC20);
    console.log(`offcahinBasicOrders: ${JSON.stringify(offchainBasicOrders)}`);
    for (let i = 0; i < offchainBasicOrders.length; i++) {
      offchainBasicSignatures.push(await getOrderSignature(offchainBasicOrders[i], TEST_CONFIG.SIGNER_ADDRESSES.SELLER));
    }

    // Calculate total platform fee
    // const PLATFORM_FEE_BPS = 5;
    // const FACTOR = 100000000;
    // const priceInETH = mockNFTPriceFeed.latestAnswer();
    // const totalPlatformFee = BigInt(((priceInETH * (PLATFORM_FEE_BPS * FACTOR)) / (100 * FACTOR)) * offchainBasicOrders.length);
    const totalPlatformFee = ethers.parseEther("10");

    // Execute sweepOrders and verify balances
    await marketplace.connect(buyer).sweepOrders(offchainBasicOrders, offchainBasicSignatures, { value: totalPlatformFee });
    //   .to.emit(marketplace, "OrderFulfilled")
    //   .withArgs(orderHashes[0], TEST_CONFIG.SIGNER_ADDRESSES.BUYER, totalPlatformFee)
    //   .and.emit(marketplace, "OrderFulfilled")
    //   .withArgs(orderHashes[1], TEST_CONFIG.SIGNER_ADDRESSES.BUYER, totalPlatformFee)
    //   .and.emit(marketplace, "OrderFulfilled")
    //   .withArgs(orderHashes[2], TEST_CONFIG.SIGNER_ADDRESSES.BUYER, totalPlatformFee)
    //   .and.emit(marketplace, "OrderFulfilled")
    //   .withArgs(orderHashes[3], TEST_CONFIG.SIGNER_ADDRESSES.BUYER, totalPlatformFee);

    console.log("buyer HIGH balance: ", await high.balanceOf(buyer.address));
    console.log("buyer USDC balance: ", await usdc.balanceOf(buyer.address));

    console.log("seller HIGH balance after sweeping orders: ", await high.balanceOf(seller.address));
    console.log("seller USDC balance after sweeping orders: ", await usdc.balanceOf(seller.address));
    // Check buyer's token balance
    const buyerUSDCBalance = await usdc.balanceOf(buyer.address);
    const buyerBAYCBalance = await bayc.balanceOf(buyer.address);
    const buyerGOLDBalance = await mockERC1155.balanceOf(buyer.address, 0);
    const buyerSILVERBalance = await mockERC1155.balanceOf(buyer.address, 1);
    const buyerTHORSHAMMERBalance = await mockERC1155.balanceOf(buyer.address, 2);
    //expect(buyerUSDCBalance).to.equal(300);
    // expect(buyerBAYCBalance).to.equal(1);
    // expect(buyerGOLDBalance).to.equal(200);
    // expect(buyerSILVERBalance).to.equal(1100);
    // expect(buyerTHORSHAMMERBalance).to.equal(1);
    console.log(
      `buyer USDC balance: ${buyerUSDCBalance}, buyer BAYC balance: ${buyerBAYCBalance}, buyer GOLD balance: ${buyerGOLDBalance}, buyer SILVER balance: ${buyerSILVERBalance}, buyer THORSHAMMER balance: ${buyerTHORSHAMMERBalance}`
    );
    // Check seller's token balance
    const sellerHIGHBalance = await high.balanceOf(seller.address);
    //expect(sellerHIGHBalance).to.equal(50);
  });

  it("Should sweep multiple basic orders by sweepERC20Orders", async function () {
    // Set up diverse orders
    const isOnlyERC20 = true;
    offchainERC20Orders = await setupDiverseOrders(isOnlyERC20);
    console.log(`offchainERC20Orders: ${JSON.stringify(offchainERC20Orders)}`);
    for (let i = 0; i < offchainERC20Orders.length; i++) {
      offchainERC20Signatures.push(await getOrderSignature(offchainERC20Orders[i], TEST_CONFIG.SIGNER_ADDRESSES.SELLER));
    }

    // Calculate total platform fee
    // const PLATFORM_FEE_BPS = 5;
    // const FACTOR = 100000000;
    // const priceInETH = mockNFTPriceFeed.latestAnswer();
    // const totalPlatformFee = BigInt(((priceInETH * (PLATFORM_FEE_BPS * FACTOR)) / (100 * FACTOR)) * offchainBasicOrders.length);
    const totalPlatformFee = ethers.parseEther("10");

    // Execute sweepOrders and verify balances
    await expect(marketplace.connect(buyer).sweepERC20Orders(offchainERC20Orders, offchainERC20Signatures, { value: totalPlatformFee }));

    console.log("buyer HIGH balance: ", await high.balanceOf(buyer.address));
    console.log("buyer USDC balance: ", await usdc.balanceOf(buyer.address));

    console.log("seller HIGH balance after sweeping orders: ", await high.balanceOf(seller.address));
    console.log("seller USDC balance after sweeping orders: ", await usdc.balanceOf(seller.address));
    // Check buyer's token balance
    const buyerUSDCBalance = await usdc.balanceOf(buyer.address);
    const buyerBAYCBalance = await bayc.balanceOf(buyer.address);
    const buyerGOLDBalance = await mockERC1155.balanceOf(buyer.address, 0);
    const buyerSILVERBalance = await mockERC1155.balanceOf(buyer.address, 1);
    const buyerTHORSHAMMERBalance = await mockERC1155.balanceOf(buyer.address, 2);
    //expect(buyerUSDCBalance).to.equal(300);
    // expect(buyerBAYCBalance).to.equal(1);
    // expect(buyerGOLDBalance).to.equal(200);
    // expect(buyerSILVERBalance).to.equal(1100);
    // expect(buyerTHORSHAMMERBalance).to.equal(1);
    console.log(
      `buyer USDC balance: ${buyerUSDCBalance}, buyer BAYC balance: ${buyerBAYCBalance}, buyer GOLD balance: ${buyerGOLDBalance}, buyer SILVER balance: ${buyerSILVERBalance}, buyer THORSHAMMER balance: ${buyerTHORSHAMMERBalance}`
    );
    // Check seller's token balance
    const sellerHIGHBalance = await high.balanceOf(seller.address);
    //expect(sellerHIGHBalance).to.equal(50);
  });
  async function setupDiverseOrders(isOnlyERC20) {
    // ERC20 1
    const toSellERC20 = {
      asset: TEST_CONFIG.TOKEN_ADDRESSES.USDC,
      ids: [0],
      amountOrTokenIds: [200],
    };
    const toFulfillERC20 = {
      asset: TEST_CONFIG.TOKEN_ADDRESSES.HIGH,
      ids: [0],
      amountOrTokenIds: [20],
    };
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const fulfilled = false;

    const order1 = getBasicOrder(
      TEST_CONFIG.SIGNER_ADDRESSES.BUYER,
      TEST_CONFIG.SIGNER_ADDRESSES.SELLER,
      toSellERC20,
      toFulfillERC20,
      deadline,
      fulfilled
    );

    // ERC20 2
    const toSellERC20Sec = {
      asset: TEST_CONFIG.TOKEN_ADDRESSES.USDC,
      ids: [0],
      amountOrTokenIds: [200],
    };
    const toFulfillERC20Sec = {
      asset: TEST_CONFIG.TOKEN_ADDRESSES.HIGH,
      ids: [0],
      amountOrTokenIds: [20],
    };

    const order2 = getBasicOrder(
      TEST_CONFIG.SIGNER_ADDRESSES.BUYER,
      TEST_CONFIG.SIGNER_ADDRESSES.SELLER,
      toSellERC20Sec,
      toFulfillERC20Sec,
      deadline,
      fulfilled
    );

    // ERC721
    const toSellERC721 = {
      asset: TEST_CONFIG.TOKEN_ADDRESSES.BAYC,
      ids: [0],
      amountOrTokenIds: [2464],
    };
    const toFulfillERC721 = {
      asset: TEST_CONFIG.TOKEN_ADDRESSES.HIGH,
      ids: [0],
      amountOrTokenIds: [20],
    };

    const order3 = getBasicOrder(
      TEST_CONFIG.SIGNER_ADDRESSES.BUYER,
      TEST_CONFIG.SIGNER_ADDRESSES.SELLER,
      toSellERC721,
      toFulfillERC721,
      deadline,
      fulfilled
    );

    // ERC1155
    const toSellERC1155 = {
      asset: await mockERC1155.getAddress(),
      ids: [0, 1, 2],
      amountOrTokenIds: [100, 100, 1],
    };
    const toFulfillERC1155 = {
      asset: TEST_CONFIG.TOKEN_ADDRESSES.HIGH,
      ids: [0],
      amountOrTokenIds: [10],
    };
    const order4 = getBasicOrder(
      TEST_CONFIG.SIGNER_ADDRESSES.BUYER,
      TEST_CONFIG.SIGNER_ADDRESSES.SELLER,
      toSellERC1155,
      toFulfillERC1155,
      deadline,
      fulfilled
    );
    return isOnlyERC20 ? [order1, order2] : [order1, order2, order3, order4];
    // return [order1, order3, order4];
    // return [order1, order3, order4];
    // return [ order3, order4];
  }
});
