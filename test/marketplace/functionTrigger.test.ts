import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMarketplace } from "../deployer/deployMarketplace";
import { setupTestEnvironment } from "../deployer/setupTestEnv";
import { getOrderSignature } from "../util/signature";
import { Marketplace, OracleHandler, NFTPriceFeed, ContractAccount, SimpleDAO, GameItems, IPriceFeed, SimpleDAOV2 } from "../../typechain-types";
import { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IERC721 } from "../../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
import { IERC1155 } from "../../typechain-types/@openzeppelin/contracts/token/ERC1155/IERC1155";
import { getOrderHash } from "../util/signature";
import { getFunctionTriggerCalldata, getTriggerOrder } from "../util/helpers";
import { generateMerkleTree, searchProof } from "../util/merkleTree";
import { getProof } from "@openzeppelin/merkle-tree/dist/core";
import { TEST_CONFIG } from "../util/testConfig";

describe("Function trigger test", function () {
  let seller: any,
    buyer: any,
    usdc: IERC20,
    high: IERC20,
    mockERC1155: IERC1155,
    marketplace: Marketplace,
    oracleHandler: OracleHandler,
    contractAccount: ContractAccount,
    simpleDAO: SimpleDAO,
    simpleDAOV2: SimpleDAOV2,
    mockNFTPriceFeed: IPriceFeed;
  let offchainOrder: any;
  let sellerSignature: any;
  let offchainOrderHash: any;

  beforeEach(async () => {
    ({ seller, buyer, marketplace, oracleHandler, usdc, high, mockERC1155, contractAccount, simpleDAO, simpleDAOV2, mockNFTPriceFeed } =
      await setupTestEnvironment());

    // Prepare a proposal
    const proposal = {
      id: 1,
      executeAddr: await mockNFTPriceFeed.getAddress(),
      amount: 0,
      data: getFunctionTriggerCalldata(mockNFTPriceFeed, "setPrice", 20),
      proposalDetail: "vote to setPrice",
      executed: false,
    };
    await simpleDAOV2.submitProposal(proposal);

    // Prepare an order to trigger task
    const proposalId = 1;
    const amount = 10;
    const toSell = {
      executeAddress: await simpleDAOV2.getAddress(),
      data: getFunctionTriggerCalldata(simpleDAOV2, "vote", proposalId, amount),
    };
    const toFulfill = { asset: await high.getAddress(), ids: [0], amountOrTokenIds: [10] };
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Prepare offchain order, signature, and hash for both tests
    offchainOrder = getTriggerOrder(await buyer.getAddress(), await contractAccount.getAddress(), toSell, toFulfill, deadline, false);
    offchainOrderHash = getOrderHash(offchainOrder);
    const signer = TEST_CONFIG.SIGNER_ADDRESSES.SELLER;
    sellerSignature = await getOrderSignature(offchainOrder, signer);

    // CA for trigger order
    //await setupContractAccountForDAO(await simpleDAO.getAddress(), usdc, 100000);
    await setupContractAccountForDAO(await simpleDAOV2.getAddress(), mockERC1155, 100000);
  });
  describe("Trigger task", function () {
    it("Should fulfill off-chain trigger order on-chain and vote", async function () {
      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainOrder.toFulfill.asset)) * BigInt(offchainOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      await marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature, { value: platformFee });
      await expect(await simpleDAOV2.votes(1)).to.equal(10);
    });
    it("Should emit Vote event when a proposal is voted", async function () {
      const tx = await marketplace.fulfillOffchainOrder(offchainOrder, sellerSignature);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;
      await expect(tx)
        .to.emit(simpleDAOV2, "Vote")
        .withArgs(await contractAccount.getAddress(), 1, 10, timestamp);
    });
    it("Should execute proposal after achieving threshold", async function () {
      var offchainTriggerOrder = offchainOrder;
      offchainTriggerOrder.toSell.data = getFunctionTriggerCalldata(simpleDAOV2, "vote", 1, 10001);
      const signer = TEST_CONFIG.SIGNER_ADDRESSES.SELLER;
      const signature = await getOrderSignature(offchainTriggerOrder, signer);
      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainTriggerOrder.toFulfill.asset)) *
          BigInt(offchainTriggerOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);
      await marketplace.fulfillOffchainOrder(offchainTriggerOrder, signature, { value: platformFee });
      await expect((await simpleDAOV2.proposals(1)).executed).to.equal(true);
      console.log(`NFT new price: ${await mockNFTPriceFeed.latestAnswer()}`);
      await expect(await mockNFTPriceFeed.latestAnswer()).to.equal(20);
    });
    it("Should not execute if already executed", async function () {
      var offchainTriggerOrder = offchainOrder;
      offchainTriggerOrder.toSell.data = getFunctionTriggerCalldata(simpleDAOV2, "vote", 1, 10001);
      const signer = TEST_CONFIG.SIGNER_ADDRESSES.SELLER;
      const signature = await getOrderSignature(offchainTriggerOrder, signer);
      const platformFee =
        ((await oracleHandler.getLatestPriceInETH(offchainTriggerOrder.toFulfill.asset)) *
          BigInt(offchainTriggerOrder.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);

      await marketplace.fulfillOffchainOrder(offchainTriggerOrder, signature, { value: platformFee });
      await expect((await simpleDAOV2.proposals(1)).executed).to.equal(true);

      // Try to execute again
      var offchainTriggerOrder2 = offchainTriggerOrder;
      offchainTriggerOrder2.toSell.data = getFunctionTriggerCalldata(simpleDAOV2, "vote", 1, 10);
      const signature2 = await getOrderSignature(offchainTriggerOrder2, signer);
      const platformFee2 =
        ((await oracleHandler.getLatestPriceInETH(offchainTriggerOrder2.toFulfill.asset)) *
          BigInt(offchainTriggerOrder2.toFulfill.amountOrTokenIds[0] * 5)) /
        BigInt(100);

      //TODO: check
      await expect(marketplace.fulfillOffchainOrder(offchainTriggerOrder2, signature2, { value: platformFee2 })).to.be.revertedWith(
        "Execution failed"
      );
    });
  });

  async function setupContractAccountForDAO(executeAddress: any, votingToken: IERC1155, amount: any) {
    const votingTokenAddress = await votingToken.getAddress();
    await contractAccount.addVotingToken(executeAddress, votingTokenAddress);

    //await votingToken.connect(seller).transfer(contractAccount, amount);
    await votingToken.connect(seller).safeTransferFrom(await seller.getAddress(), await contractAccount.getAddress(), 0, amount, "0x");
    await contractAccount.connect(seller).approveVotingToken(executeAddress, amount, votingTokenAddress);
  }
});
