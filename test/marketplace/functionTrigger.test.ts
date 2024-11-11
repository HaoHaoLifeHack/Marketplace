// import { ethers } from "hardhat";
// import { expect } from "chai";
// import { deployMarketplace } from "../deployer/deployMarketplace";
// import { setupTestEnvironment } from "../deployer/setupTestEnv";
// import { getOrderSignature } from "../util/signature";
// import { Marketplace, OracleHandler, NFTPriceFeed, ContractAccount, SimpleDAO, GameItems } from "../../typechain-types";
// import { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
// import { IERC721 } from "../../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
// import { getOrderHash } from "../util/signature";
// import { getFunctionTriggerCalldata, getTriggerOrder } from "../util/helpers";
// import { generateMerkleTree, searchProof } from "../util/merkleTree";
// import { getProof } from "@openzeppelin/merkle-tree/dist/core";

// describe("Function trigger test", function () {
//   let owner,
//     seller,
//     buyer,
//     oracleHandler: OracleHandler,
//     mockNFTPriceFeed,
//     high: IERC20,
//     usdc: IERC20,
//     bayc: IERC721,
//     azuki: IERC721,
//     mockERC1155: GameItems,
//     contractAccount: ContractAccount,
//     simpleDAO: SimpleDAO;
//   let marketplace: Marketplace;
//   let offchainOrder: any;
//   let sellerSignature: any;
//   let offchainOrderHash: any;
//   let offchainOrdersForMerkle: any[];

//   beforeEach(async () => {
//     ({ owner, seller, buyer, oracleHandler, mockNFTPriceFeed, marketplace, high, usdc, bayc, azuki, mockERC1155, contractAccount, simpleDAO } =
//       await deployMarketplace());
//     setupTestEnvironment();

//     // Prepare an order to trigger task
//     const proposalId = 1;
//     const amount = 10;
//     const toSell = {
//       executeAddress: await simpleDAO.getAddress(),
//       data: getFunctionTriggerCalldata(simpleDAO, "vote", proposalId, amount),
//     };
//     const toFulfill = { asset: await high.getAddress(), ids: [0], amountOrTokenIds: [10] };
//     const deadline = Math.floor(Date.now() / 1000) + 3600;

//     // Prepare offchain order, signature, and hash for both tests
//     offchainOrder = getTriggerOrder(await buyer.getAddress(), await seller.getAddress(), toSell, toFulfill, deadline, false);
//     offchainOrderHash = getOrderHash(offchainOrder);
//     sellerSignature = await getOrderSignature(offchainOrder);

//     // Prepare offchain order for merkle tree
//     const buyerAddress = await buyer.getAddress();
//     const sellerAddress = await seller.getAddress();
//     offchainOrdersForMerkle = [];
//     for (let i = 0; i < 8; i++) {
//       offchainOrdersForMerkle.push(getTriggerOrder(buyerAddress, sellerAddress, toSell, toFulfill, deadline, false));
//     }
//     await setupContractAccountForDAO();
//   });
// });
