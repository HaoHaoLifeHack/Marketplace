import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMarketplace } from "../deployer/deployMarketplace";
import { setupTestEnvironment } from "../deployer/setupTestEnv";
import { getOrderSignature, getOrderBasicHash } from "../util/signature";
import { Marketplace, OracleHandler, NFTPriceFeed, ContractAccount, SimpleDAO, GameItems, IPriceFeed } from "../../typechain-types";
import { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IERC721 } from "../../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
import { IERC1155 } from "../../typechain-types/@openzeppelin/contracts/token/ERC1155/IERC1155";
import { TEST_CONFIG } from "../util/testConfig";
import { getBasicOrder, getUniqueERC20Orders } from "../util/helpers";

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

  it("Should revert if msg.value less than platform fee required", async function () {
    // Set up diverse orders
    const isOnlyERC20 = false;
    offchainBasicOrders = await setupDiverseOrders(isOnlyERC20);

    for (let i = 0; i < offchainBasicOrders.length; i++) {
      offchainBasicSignatures.push(await getOrderSignature(offchainBasicOrders[i], TEST_CONFIG.SIGNER_ADDRESSES.SELLER));
    }

    // Execute sweepOrders
    await expect(marketplace.connect(buyer).sweepOrders(offchainBasicOrders, offchainBasicSignatures, { value: 0 })).to.be.revertedWith(
      "Insufficient ETH for platform fee"
    );
  });

  it("Should sweep multiple basic orders combined with ERC721 or ERC1155 by sweepOrders", async function () {
    // Set up diverse orders
    const isOnlyERC20 = false;
    const offchainBasicOrders = await setupDiverseOrders(isOnlyERC20);
    const offchainBasicSignatures = [];
    // Calculate total platform fee
    let totalPlatformFee = BigInt(0);
    for (let i = 0; i < offchainBasicOrders.length; i++) {
      offchainBasicSignatures.push(await getOrderSignature(offchainBasicOrders[i], TEST_CONFIG.SIGNER_ADDRESSES.SELLER));
      const latestAnswer = await oracleHandler.getLatestPriceInETH(offchainBasicOrders[i].toFulfill.asset);
      totalPlatformFee += (latestAnswer * BigInt(offchainBasicOrders[i].toFulfill.amountOrTokenIds[0] * 5)) / BigInt(100);
    }

    // Execute sweepOrders and verify balances
    await marketplace.connect(buyer).sweepOrders(offchainBasicOrders, offchainBasicSignatures, { value: totalPlatformFee });

    // Check buyer's token balance
    const buyerUSDCBalance = await usdc.balanceOf(buyer.address);
    const buyerBAYCBalance = await bayc.balanceOf(buyer.address);
    const buyerGOLDBalance = await mockERC1155.balanceOf(buyer.address, 0);
    const buyerSILVERBalance = await mockERC1155.balanceOf(buyer.address, 1);
    const buyerTHORSHAMMERBalance = await mockERC1155.balanceOf(buyer.address, 2);
    expect(buyerUSDCBalance).to.equal(400);
    expect(buyerBAYCBalance).to.equal(1);
    expect(buyerGOLDBalance).to.equal(200);
    expect(buyerSILVERBalance).to.equal(1100);
    expect(buyerTHORSHAMMERBalance).to.equal(1);

    // Check seller's token balance
    const sellerHIGHBalance = await high.balanceOf(seller.address);
    expect(sellerHIGHBalance).to.equal(70);
  });

  it("Should sweep multiple basic orders by sweepERC20Orders", async function () {
    // Set up diverse orders
    const isOnlyERC20 = true;
    offchainERC20Orders = await setupDiverseOrders(isOnlyERC20);

    // Calculate total platform fee
    let totalPlatformFee = BigInt(0);
    for (let i = 0; i < offchainERC20Orders.length; i++) {
      offchainERC20Signatures.push(await getOrderSignature(offchainERC20Orders[i], TEST_CONFIG.SIGNER_ADDRESSES.SELLER));
      const latestAnswer = await oracleHandler.getLatestPriceInETH(offchainERC20Orders[i].toFulfill.asset);
      totalPlatformFee += (latestAnswer * BigInt(offchainERC20Orders[i].toFulfill.amountOrTokenIds[0] * 5)) / BigInt(100);
    }

    // Execute sweepOrders and verify balances
    await marketplace.connect(buyer).sweepERC20Orders(offchainERC20Orders, offchainERC20Signatures, { value: totalPlatformFee });

    // Check buyer's token balance
    const buyerUSDCBalance = await usdc.balanceOf(buyer.address);
    expect(buyerUSDCBalance).to.equal(400);

    // Check seller's token balance
    const sellerHIGHBalance = await high.balanceOf(seller.address);
    expect(sellerHIGHBalance).to.equal(40);
  });

  it("Should only sweep multiple basic orders combined by ERC20 Token", async function () {
    // Set up diverse orders
    const isOnlyERC20 = false;
    const offchainBasicOrders = await setupDiverseOrders(isOnlyERC20);
    const offchainBasicSignatures = [];

    // Calculate total platform fee
    let totalPlatformFee = BigInt(0);
    for (let i = 0; i < offchainBasicOrders.length; i++) {
      offchainBasicSignatures.push(await getOrderSignature(offchainBasicOrders[i], TEST_CONFIG.SIGNER_ADDRESSES.SELLER));
      const latestAnswer = await oracleHandler.getLatestPriceInETH(offchainBasicOrders[i].toFulfill.asset);
      totalPlatformFee += (latestAnswer * BigInt(offchainBasicOrders[i].toFulfill.amountOrTokenIds[0] * 5)) / BigInt(100);
    }

    // Execute sweepOrders
    await expect(
      marketplace.connect(buyer).sweepERC20Orders(offchainBasicOrders, offchainBasicSignatures, { value: totalPlatformFee })
    ).to.be.revertedWith("Only ERC20 tokens allowed");
  });

  it("Should not sweep when overing 10 types of token", async function () {
    const offchainUniqueOrders = getUniqueERC20Orders();
    const offchainUniqueSignatures = [];
    //console.log(`offchainBasicOrders length: ${JSON.stringify(offchainUniqueOrders.length)}`);

    // Calculate total platform fee
    let totalPlatformFee = BigInt(0);
    for (let i = 0; i < offchainUniqueOrders.length; i++) {
      offchainUniqueSignatures.push(await getOrderSignature(offchainUniqueOrders[i], TEST_CONFIG.SIGNER_ADDRESSES.SELLER));
      const latestAnswer = await oracleHandler.getLatestPriceInETH(offchainUniqueOrders[i].toFulfill.asset);
      totalPlatformFee += (latestAnswer * BigInt(offchainUniqueOrders[i].toFulfill.amountOrTokenIds[0] * 5)) / BigInt(100);
    }

    // Execute sweepOrders
    await expect(marketplace.connect(buyer).sweepOrders(offchainUniqueOrders, offchainUniqueSignatures, { value: totalPlatformFee })).to.be.reverted;
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
  }
});
