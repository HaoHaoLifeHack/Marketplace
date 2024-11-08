import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMarketplace } from "../deployer/deployMarketplace";
import { setupTestEnvironment } from "../deployer/setupTestEnv";
import { generateOrderSignature } from "../util/signature";
import { Marketplace, OracleHandler, NFTPriceFeed, ContractAccount, SimpleDAO, GameItems } from "../../typechain-types";
import { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IERC721 } from "../../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
import { getOrderHash } from "../util/signature";
import { getFunctionTriggerCalldata, getTriggerOrder } from "../util/helpers";
import { generateMerkleTree, searchProof } from "../util/merkleTree";
import { getProof } from "@openzeppelin/merkle-tree/dist/core";

describe("Function trigger test", function () {
  let owner,
    seller,
    buyer,
    oracleHandler: OracleHandler,
    mockNFTPriceFeed,
    high: IERC20,
    usdc: IERC20,
    bayc: IERC721,
    azuki: IERC721,
    mockERC1155: GameItems,
    contractAccount: ContractAccount,
    simpleDAO: SimpleDAO;
  let marketplace: Marketplace;
  let offchainOrder: any;
  let sellerSignature: any;
  let offchainOrderHash: any;
  let offchainOrdersForMerkle: any[];

  beforeEach(async () => {
    ({ owner, seller, buyer, oracleHandler, mockNFTPriceFeed, marketplace, high, usdc, bayc, azuki, mockERC1155, contractAccount, simpleDAO } =
      await deployMarketplace());
    setupTestEnvironment();
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
    await setupContractAccountForDAO();
  });

  describe("Fulfill order", function () {
    it("Should fulfill off-chain order on-chain", async function () {
      const receipt = await marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature);
      await expect(await marketplace.fulfilledOrders(offchainOrderHash)).to.be.true;
    });

    it("Should emit OrderFulfilled event when an order is fulfilled", async function () {
      await expect(await marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature))
        .to.emit(marketplace, "OrderFulfilled")
        .withArgs(offchainOrderHash, offchainOrder.buyer, 0); // Check that the event is emitted with the correct argument
    });

    it("Should fulfill off-chain NFT order on-chain", async function () {
      const proposalId = 1;
      const amount = 10;
      const toSell = {
        executeAddress: await simpleDAO.getAddress(),
        data: getFunctionTriggerCalldata(simpleDAO, "vote", proposalId, amount),
      };
      const toFulfill = { asset: await azuki.getAddress(), ids: [0], amountOrTokenIds: [10] };
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Prepare offchain order, signature, and hash for both tests
      const offchainNFTOrder = getTriggerOrder(await buyer.getAddress(), await seller.getAddress(), toSell, toFulfill, deadline, false);
      const offchainNFTOrderHash = getOrderHash(offchainNFTOrder);
      const signature = await generateOrderSignature(offchainNFTOrder);
      await marketplace.fulfillOffchainOrder(offchainNFTOrder, signature);
      await expect(await marketplace.fulfilledOrders(offchainNFTOrderHash)).to.be.true;
    });

    it("Should fulfill off-chain basic order on-chain and transfer toSell asset to buyer", async function () {
      await marketplace.fulfillOffchainOrder(offchainOrderBasic, sellerSignatureBasic);
      await expect(await marketplace.fulfilledOrders(offchainOrderBasicHash)).to.be.true;
      const usdcBalance = await usdc.balanceOf(buyerAddress);
      await expect(usdcBalance).to.equal(100);
    });
  });

  describe("Fulfill order constructed by merkle tree", function () {
    it("Should fulfill order with merkle proof on-chain", async function () {
      const tree = await generateMerkleTree(offchainOrdersForMerkle);
      await marketplace.connect(seller).updateMerkleRoot(tree.root);
      const signature = await generateOrderSignature(offchainOrdersForMerkle[0]);

      const fulfillTx = await marketplace.fulfillOffchainOrderWithMerkleProof(
        offchainOrdersForMerkle[0],
        signature,
        await searchProof(tree, flattenOrder(offchainOrdersForMerkle[0]))
      );
      expect(await marketplace.fulfilledOrders(offchainOrderHash)).to.be.true;
    });
  });

  async function setupContractAccountForDAO() {
    await contractAccount.addVotingToken(await simpleDAO.getAddress(), usdc, false);
    // Deposit voting tokens in his own account
    await usdc.connect(seller).transfer(contractAccount, 10000);
    // Approve the contract account
    await contractAccount.connect(seller).approveVotingToken(await simpleDAO.getAddress(), 10000, 0);
  }
});
