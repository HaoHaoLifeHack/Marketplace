import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMarketplace } from "../deployer/deployMarketplace";
import { setupTestEnvironment } from "../deployer/setupTestEnv";
import "../util/helpers";
import { getOrderSignature } from "../util/signature";
import {
  Marketplace,
  OracleHandler,
  NFTPriceFeed,
  ContractAccount,
  SimpleDAO,
  SimpleDAOV2,
  GameItems,
  IERC20,
  IERC721,
  IPriceFeed,
} from "../../typechain-types";
import { getOrderHash, OrderStruct } from "../util/signature";
import { getFunctionTriggerCalldata, getTriggerOrder, flattenOrder } from "../util/helpers";
import { generateMerkleTree, searchProof } from "../util/merkleTree";
import { getProof } from "@openzeppelin/merkle-tree/dist/core";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { TEST_CONFIG } from "../util/testConfig";

describe("OffchainSign test", function () {
  let seller: any,
    buyer: any,
    marketplace: Marketplace,
    oracleHandler: OracleHandler,
    contractAccount: ContractAccount,
    simpleDAO: SimpleDAO,
    mockNFTPriceFeed: IPriceFeed,
    high: IERC20,
    usdc: IERC20,
    weth: IERC20,
    bayc: IERC721,
    azuki: IERC721,
    mockERC1155: GameItems;

  let offchainOrder: OrderStruct;
  let sellerSignature: any;
  let offchainOrderHash: any;
  let merkleOrders: any[];

  beforeEach(async () => {
    ({ seller, buyer, oracleHandler, mockNFTPriceFeed, marketplace, high, usdc, weth, bayc, azuki, mockERC1155, contractAccount, simpleDAO } =
      await setupTestEnvironment());

    // Default parameters
    const buyerAddress = await buyer.getAddress();
    const sellerAddress = await seller.getAddress();
    const toSell = {
      executeAddress: await usdc.getAddress(),
      data: getFunctionTriggerCalldata(usdc, "transferFrom", sellerAddress, buyerAddress, 100),
    };
    const toFulfill = { asset: await high.getAddress(), ids: [0], amountOrTokenIds: [10] };
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Prepare offchain order, signature, and hash for both tests
    offchainOrder = getTriggerOrder(buyerAddress, sellerAddress, toSell, toFulfill, deadline, false);
    offchainOrderHash = getOrderHash(offchainOrder);
    sellerSignature = await getOrderSignature(offchainOrder, sellerAddress);

    // Prepare offchain order for merkle tree
    merkleOrders = [];
    for (let i = 0; i < 8; i++) {
      merkleOrders.push(getTriggerOrder(buyerAddress, sellerAddress, toSell, toFulfill, deadline, false));
    }
  });

  describe("List & Cancel order", function () {
    it("Should off-chain cancel order", async function () {
      await marketplace.cancelOrder(offchainOrder, sellerSignature);
      expect(await marketplace.canceledOrders(offchainOrderHash)).to.be.true;
    });

    it("Should emit OrderCancelled event when an order is cancelled", async function () {
      const tx = await marketplace.cancelOrder(offchainOrder, sellerSignature);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;
      await expect(tx).to.emit(marketplace, "OrderCancelled").withArgs(offchainOrderHash, timestamp);
    });
  });

  describe("List & Cancel orders constructed by merkle tree", function () {
    it("Should update merkle root on-chain", async function () {
      const tree = await generateMerkleTree(merkleOrders);
      await marketplace.connect(seller).updateMerkleRoot(tree.root);

      expect(await marketplace.merkleRoots(await seller.getAddress())).to.equal(tree.root);
    });
    it("Should cancel batch orders on-chain", async function () {
      const tree = await generateMerkleTree(merkleOrders);
      await marketplace.connect(seller).updateMerkleRoot(tree.root);
      await marketplace.connect(seller).cancelMerkleOrders();
      expect(await marketplace.merkleRoots(seller)).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
  });

  describe("Fulfill order", function () {
    it("Should fulfill off-chain order on-chain", async function () {
      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainOrder.toFulfill.asset)) * BigInt(offchainOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      const receipt = await marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature, { value: platformFee });
      await expect(await marketplace.fulfilledOrders(offchainOrderHash)).to.be.true;
    });

    it("Should emit OrderFulfilled event when an order is fulfilled", async function () {
      const tx = await marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;
      await expect(tx).to.emit(marketplace, "OrderFulfilled").withArgs(offchainOrderHash, offchainOrder.buyer, 0, timestamp);
    });

    it("Should fulfill off-chain order with ERC721 on-chain", async function () {
      var offchainNFTOrder = offchainOrder;
      offchainNFTOrder.toFulfill.asset = await azuki.getAddress();
      offchainNFTOrder.toFulfill.amountOrTokenIds = [7737];
      const offchainNFTOrderHash = getOrderHash(offchainNFTOrder);
      const signature = await getOrderSignature(offchainNFTOrder, await seller.getAddress());
      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainNFTOrder.toFulfill.asset)) * BigInt(offchainNFTOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      await marketplace.fulfillOffchainOrder(offchainNFTOrder, signature, { value: platformFee });
      await expect(await marketplace.fulfilledOrders(offchainNFTOrderHash)).to.be.true;
    });
    it("Should fulfill off-chain order with single asset in ERC1155 on-chain", async function () {
      var offchain1155Order = offchainOrder;
      offchain1155Order.toFulfill.asset = await mockERC1155.getAddress();
      offchain1155Order.toFulfill.ids[0] = 0;
      offchain1155Order.toFulfill.amountOrTokenIds = [1];
      const offchain1155OrderHash = getOrderHash(offchain1155Order);
      const signature = await getOrderSignature(offchain1155Order, await seller.getAddress());

      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchain1155Order.toFulfill.asset)) * BigInt(offchain1155Order.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      await marketplace.fulfillOffchainOrder(offchain1155Order, signature, { value: platformFee });
      await expect(await marketplace.fulfilledOrders(offchain1155OrderHash)).to.be.true;
    });
    it("Should fulfill off-chain order with batch asset in ERC1155 on-chain", async function () {
      var offchain1155Order = offchainOrder;
      offchain1155Order.toFulfill.asset = await mockERC1155.getAddress();
      offchain1155Order.toFulfill.ids[0] = 0;
      offchain1155Order.toFulfill.ids[1] = 1;
      offchain1155Order.toFulfill.amountOrTokenIds = [1, 1];
      const offchain1155OrderHash = getOrderHash(offchain1155Order);
      const signature = await getOrderSignature(offchain1155Order, await seller.getAddress());

      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchain1155Order.toFulfill.asset)) * BigInt(offchain1155Order.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      await marketplace.fulfillOffchainOrder(offchain1155Order, signature, { value: platformFee });
      await expect(await marketplace.fulfilledOrders(offchain1155OrderHash)).to.be.true;
    });
    it("Should fulfill off-chain order with WETH on-chain", async function () {
      var offchainWETHOrder = offchainOrder;
      offchainWETHOrder.toFulfill.asset = await weth.getAddress();
      offchainWETHOrder.toFulfill.amountOrTokenIds = [1];
      const offchainWETHOrderOrderHash = getOrderHash(offchainWETHOrder);
      const signature = await getOrderSignature(offchainWETHOrder, await seller.getAddress());

      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainWETHOrder.toFulfill.asset)) * BigInt(offchainWETHOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      await marketplace.fulfillOffchainOrder(offchainWETHOrder, signature, { value: platformFee });
      await expect(await marketplace.fulfilledOrders(offchainWETHOrderOrderHash)).to.be.true;
    });
    it("Should not fulfill a expired order", async function () {
      var expiredOrder: OrderStruct = offchainOrder;
      expiredOrder.deadline = 0;
      const sellerSignature = await getOrderSignature(expiredOrder, await seller.getAddress());
      await expect(marketplace.fulfillOffchainOrder(expiredOrder, sellerSignature)).to.be.revertedWith("Order expired");
    });
    it("Should not fulfill a canceled order", async function () {
      await marketplace.cancelOrder(offchainOrder, sellerSignature);
      await expect(marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature)).to.be.revertedWith("Order already cancelled");
    });
    it("Should not fulfill a fulfilled order", async function () {
      await marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature);
      await expect(marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature)).to.be.revertedWith("Order already fulfilled");
    });
  });

  describe("Fulfill order constructed by merkle tree", function () {
    it("Should fulfill order with merkle proof on-chain", async function () {
      const tree = await generateMerkleTree(merkleOrders);
      await marketplace.connect(seller).updateMerkleRoot(tree.root);
      const orderHash = getOrderHash(merkleOrders[0]);
      const signature = await getOrderSignature(merkleOrders[0], await seller.getAddress());
      const proof = await searchProof(tree, flattenOrder(merkleOrders[0]));
      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainOrder.toFulfill.asset)) * BigInt(offchainOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);

      await marketplace.fulfillOffchainOrderWithMerkleProof(merkleOrders[0], signature, proof, {
        value: platformFee,
      });
      expect(await marketplace.fulfilledOrders(orderHash)).to.be.true;
    });
    it("Should revert order with wrong merkle proof", async function () {
      const tree = await generateMerkleTree(merkleOrders);
      await marketplace.connect(seller).updateMerkleRoot(tree.root);
      const orderHash = getOrderHash(merkleOrders[0]);
      const signature = await getOrderSignature(merkleOrders[0], await seller.getAddress());
      const proof = tree.getProof(2);
      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainOrder.toFulfill.asset)) * BigInt(offchainOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      await expect(
        marketplace.fulfillOffchainOrderWithMerkleProof(merkleOrders[0], signature, proof, {
          value: platformFee,
        })
      ).to.be.revertedWith("Invalid merkle proof");
    });
  });
});
