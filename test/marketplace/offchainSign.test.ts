import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMarketplace } from "../deployer/deployMarketplace";
import { setupTestEnvironment } from "../deployer/setupTestEnv";
import "../util/helpers";
import { generateOrderSignature } from "../util/signature";
import { Marketplace } from "../../typechain-types";
import { getOrderHash } from "../util/signature";
import { getFunctionTriggerCalldata, getTriggerOrder } from "../util/helpers";
import { generateMerkleTree, searchProof } from "../util/merkleTree";
import { getProof } from "@openzeppelin/merkle-tree/dist/core";

describe("OffchainSign test", function () {
  let owner, seller, buyer, oracleHandler, mockNFTPriceFeed, high, usdc, bayc, azuki, mockERC1155, contractAccount, simpleDAO;
  let marketplace: Marketplace;
  let offchainOrder: any;
  let sellerSignature: any;
  let offchainOrderHash: any;
  let offchainOrdersForMerkle: any[];

  beforeEach(async () => {
    ({ owner, seller, buyer, oracleHandler, mockNFTPriceFeed, marketplace, high, usdc, bayc, azuki, mockERC1155, contractAccount, simpleDAO } =
      await deployMarketplace());
    const proposalId = 1;
    const amount = 10;
    const toSell = {
      executeAddress: await simpleDAO.getAddress(),
      data: getFunctionTriggerCalldata(simpleDAO, "vote", proposalId, amount),
    };
    const toFulfill = { asset: await high.getAddress(), ids: [0], amountOrTokenIds: [10] };
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Prepare offchain order, signature, and hash for both tests
    offchainOrder = getTriggerOrder(await buyer.getAddress(), await seller.getAddress(), toSell, toFulfill, deadline, false);
    offchainOrderHash = getOrderHash(offchainOrder);
    sellerSignature = await generateOrderSignature(offchainOrder);

    // Prepare offchain order for merkle tree
    const buyerAddress = await buyer.getAddress();
    const sellerAddress = await seller.getAddress();
    offchainOrdersForMerkle = [];
    for (let i = 0; i < 8; i++) {
      offchainOrdersForMerkle.push(getTriggerOrder(buyerAddress, sellerAddress, toSell, toFulfill, deadline, false));
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
      const tree = await generateMerkleTree(offchainOrdersForMerkle);
      await marketplace.connect(seller).updateMerkleRoot(tree.root);

      expect(await marketplace.merkleRoots(await seller.getAddress())).to.equal(tree.root);
    });
    it("Should cancel batch orders on-chain", async function () {
      const tree = await generateMerkleTree(offchainOrdersForMerkle);
      await marketplace.connect(seller).updateMerkleRoot(tree.root);
      await marketplace.connect(seller).cancelMerkleOrders();
      const signature = await generateOrderSignature(offchainOrder);
      await expect(marketplace.fulfillOffchainOrderWithMerkleProof(offchainOrder, signature, tree.getProof(0))).to.be.revertedWith(
        "Invalid merkle proof"
      );
    });
  });
});
