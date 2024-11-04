import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  Marketplace,
  OracleHandler,
  NFTPriceFeed,
  ContractAccount,
  SimpleDAO,
  SimpleDAOV2,
  GameItems,
} from "../typechain-types";
import {
  erc20,
  erc721,
} from "../typechain-types/@openzeppelin/contracts/token";
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IERC721 } from "../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
import { AddressLike } from "ethers";
import { any, boolean } from "hardhat/internal/core/params/argumentTypes";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { standardLeafHash } from "@openzeppelin/merkle-tree/src/hashes";
import { Address } from "hardhat-deploy/types";
import { config as dotenvConfig } from "dotenv";
import { token } from "../typechain-types/@openzeppelin/contracts";

dotenvConfig({ path: "./.env" });

describe("Marketplace Contract", function () {
  let marketplace: Marketplace;
  let oracleHandler: OracleHandler;
  let nftPriceFeed: NFTPriceFeed;
  let contractAccount: ContractAccount;
  let contractAccountAddress: AddressLike;
  let simpleDAO: SimpleDAO;
  let simpleDAOV2: SimpleDAOV2;
  let owner: any;
  let seller: any;
  let buyer: any;
  let high: any;
  let usdc: any;
  let bayc: any;
  let azuki: any;
  let gameItems: GameItems;
  let gameItemsAddress: AddressLike;
  let sellerAddress: AddressLike;
  let sellerWallet: any;
  let sellerSignature: any;
  let sellerSignatureForNFT: any;
  let sellerSignatureBasic: any;
  let buyerAddress: AddressLike;
  let buyerWallet: any;
  let ownerWallet: any;
  let highAddress: AddressLike;
  let usdcAddress: AddressLike;
  let baycAddress: AddressLike;
  let azukiAddress: AddressLike;
  let testCalldata: any;
  let offchainOrder: any;
  let offchainOrderBasic: any;
  let offchainOrderHash: any;
  let offchainOrderBasicHash: any;
  let offchainNFTOrder: any;
  let offchainNFTOrderHash: any;
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
    await loadFixture(deploySimpleDAOFixture);
    await loadFixture(deployGameItemsFixture);
    await loadFixture(deploySimpleDAOV2Fixture);
    await loadFixture(deployOracleHandlerFixture);
    await loadFixture(deployContractAccountFixture);
    await loadFixture(initializeTokenAmountFixture);
    await loadFixture(offchainSignedDataFixture);
  });

  async function deployMarketplaceFixture() {
    // Define the test wallet
    const sellerPrivateKey = process.env.SELLER_PRIVATE_KEY; // #19 address: 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
    sellerWallet = new ethers.Wallet(sellerPrivateKey);

    const buyerPrivateKey = process.env.BUYER_PRIVATE_KEY; // #18 address: 0xdD2FD4581271e230360230F9337D5c0430Bf44C0
    buyerWallet = new ethers.Wallet(buyerPrivateKey);

    const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY; // #17 address: 0xbDA5747bFD65F08deb54cb465eB87D40e51B197E
    ownerWallet = new ethers.Wallet(ownerPrivateKey);

    console.log("seller address:", sellerWallet.address);
    console.log("buyer address:", buyerWallet.address);
    console.log("owner address:", ownerWallet.address);

    // Address
    sellerAddress = await sellerWallet.address;
    buyerAddress = await buyerWallet.address;

    // Signer
    seller = await ethers.getSigner(sellerWallet.address);
    buyer = await ethers.getSigner(buyerWallet.address);
    owner = await ethers.getSigner(ownerWallet.address);

    // Deploy OracleHandler
    const OracleHandler = await ethers.getContractFactory("OracleHandler");
    oracleHandler = await OracleHandler.deploy(USDC_ETH_PRICEFEED_ADDRESS, {
      gasLimit: 30000000,
      maxFeePerGas: ethers.parseUnits("20000", "gwei"), // Set higher maxFeePerGas
      //   maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"), // Set a priority fee
    });

    // Fork erc20
    highAddress = "0x71ab77b7dbb4fa7e017bc15090b2163221420282";
    usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

    high = await ethers.getContractAt("IERC20", highAddress);
    usdc = await ethers.getContractAt("IERC20", usdcAddress);

    // Fork erc721
    baycAddress = "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
    azukiAddress = "0xed5af388653567af2f388e6224dc7c4b3241c544";

    bayc = await ethers.getContractAt("IERC721", baycAddress);
    azuki = await ethers.getContractAt("IERC721", azukiAddress);

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace", owner);
    marketplace = await Marketplace.deploy(oracleHandler.getAddress(), {
      gasLimit: 30000000,
      maxFeePerGas: ethers.parseUnits("20000", "gwei"), // Set higher maxFeePerGas
      //   maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"), // Set a priority fee
    });

    // Deploy NFTPriceFeed
    const NFTPriceFeed = await ethers.getContractFactory("NFTPriceFeed");
    nftPriceFeed = await NFTPriceFeed.deploy({
      gasLimit: 30000000,
      maxFeePerGas: ethers.parseUnits("20000", "gwei"), // Set higher maxFeePerGas
      //   maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"), // Set a priority fee
    });
    console.log(`NFTPriceFeed address: ${await nftPriceFeed.getAddress()}`);
  }
  async function deployContractAccountFixture() {
    //console.log("seller deploy address:", seller.address);
    const ContractAccount = await ethers.getContractFactory(
      "ContractAccount",
      seller
    );
    contractAccount = await ContractAccount.deploy();
    contractAccountAddress = await contractAccount.getAddress();
    console.log(`ContractAccount address: ${contractAccountAddress}`);
    console.log(`ContractAccount owner: ${await contractAccount.owner()}`);
  }
  async function deployGameItemsFixture() {
    const GameItems = await ethers.getContractFactory("GameItems", seller);
    gameItems = await GameItems.deploy();
    console.log(
      `Seller's GOLD address: ${await gameItems.balanceOf(sellerAddress, 1)}`
    );
    console.log(
      `Seller's SILVER address: ${await gameItems.balanceOf(sellerAddress, 2)}`
    );
    console.log(
      `Seller's THORS_Hammer address: ${await gameItems.balanceOf(
        sellerAddress,
        3
      )}`
    );
  }
  async function deploySimpleDAOFixture() {
    const SimpleDAO = await ethers.getContractFactory("SimpleDAO", seller);
    simpleDAO = await SimpleDAO.deploy(usdc, await usdc.totalSupply());
    console.log(`DAO address: ${await simpleDAO.getAddress()}`);
    console.log(`DAO voting token: ${await simpleDAO.votingToken()}`);
    console.log(`DAO totalSupply: ${await simpleDAO.totalSupply()}`);

    // Add proposal
    const proposal = {
      id: 1,
      executeAddr: await nftPriceFeed.getAddress(),
      amount: 0,
      data: getFunctionTriggerCalldata(nftPriceFeed, "setPrice", 20),
      proposalDetail: "vote to setPrice",
      executed: false,
    };

    console.log("const new proposal:", proposal);
    await simpleDAO.submitProposal(proposal);
    const proposalId = 1;
    const defaultProposal = await simpleDAO.proposals(proposalId);
    console.log("proposal on-chain created:", defaultProposal);
  }

  async function deploySimpleDAOV2Fixture() {
    // Setup voting token for DAO
    const SimpleDAOV2 = await ethers.getContractFactory("SimpleDAOV2", seller);
    simpleDAOV2 = await SimpleDAOV2.deploy(
      gameItems,
      1, //use GOLD as voting amount
      await gameItems.totalSupplies(1)
    );
    gameItemsAddress = await gameItems.getAddress();
    console.log(`DAO address: ${await simpleDAOV2.getAddress()}`);
    console.log(`DAO voting token: ${await simpleDAOV2.votingToken()}`);
    console.log(`DAO totalSupply: ${await simpleDAOV2.totalSupply()}`);

    // Add proposal
    const proposal = {
      id: 1,
      executeAddr: await nftPriceFeed.getAddress(),
      amount: 0,
      data: getFunctionTriggerCalldata(nftPriceFeed, "setPrice", 20),
      proposalDetail: "vote to setPrice",
      executed: false,
    };

    console.log("const new proposal:", proposal);
    await simpleDAOV2.submitProposal(proposal);
    const proposalId = 1;
    const defaultProposal = await simpleDAO.proposals(proposalId);
    console.log("proposal on-chain created:", defaultProposal);
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

    await network.provider.send("hardhat_setBalance", [
      contractAccountAddress,
      ethers.toBeHex(ethInitAmount).toString(),
    ]);
    const caBalance = await ethers.provider.getBalance(contractAccountAddress);

    console.log("Contract Account ETH balance: ", caBalance);
    await network.provider.send("hardhat_setBalance", [
      await simpleDAO.getAddress(),
      ethers.toBeHex(ethInitAmount).toString(),
    ]);
    const finalBalance = await ethers.provider.getBalance(
      await simpleDAO.getAddress()
    );
    console.log("DAO ETH balance: ", finalBalance);
    // Impersonate a USDC holder with a large balance (whale)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhaleAddress],
    });
    const usdcWhale = await ethers.getSigner(usdcWhaleAddress);

    // Initial ERC20 amount
    // Seller get USDC
    // Buyer get HIGH

    // Check initial USDC balance of test account
    const initSellerBalance = await usdc.balanceOf(sellerAddress);
    initSellerBalance != 0
      ? await usdc
          .connect(usdcWhale)
          .transfer(sellerAddress, usdcInitAmount - initSellerBalance)
      : await usdc.connect(usdcWhale).transfer(sellerAddress, usdcInitAmount);
    console.log(`seller usdc amount: ${await usdc.balanceOf(sellerAddress)}`);
    // Impersonate a High holder with a large balance (whale)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [highWhaleAddress],
    });
    const highWhale = await ethers.getSigner(highWhaleAddress);

    // Check initial HIGH balance of test account
    const initHighBalance = await high.balanceOf(buyerAddress);
    console.log(`buyer init high amount: ${initHighBalance}`);
    console.log(`highInitAmount: ${highInitAmount}`);

    initHighBalance != 0
      ? await high
          .connect(highWhale)
          .transfer(buyerAddress, highInitAmount - initHighBalance)
      : await high.connect(highWhale).transfer(buyerAddress, highInitAmount);

    console.log(
      `buyer high amount after initialization: ${await high.balanceOf(
        buyerAddress
      )}`
    );

    // Initial NFT amount
    // Buyer get AZUKI
    // Seller get BAYC
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

    setupAllowanceToMarketplace();
  }

  async function offchainSignedDataFixture() {
    // Default
    const proposalId = 1;
    const amount = 10;
    testCalldata = getFunctionTriggerCalldata(
      simpleDAO,
      "vote",
      proposalId,
      amount
    );

    // console.log("Offchain-gen trigger external calldata:", testCalldata);

    // Define the order data
    offchainOrder = {
      eid: 1,
      buyer: buyerAddress,
      seller: contractAccountAddress,
      toSell: {
        executeAddress: await simpleDAO.getAddress(),
        data: testCalldata,
      },
      toFulfill: {
        asset: highAddress, // high
        ids: [0],
        amountOrTokenIds: [10], // Amount (ERC20) or Token ID (ERC721)
      },
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiration
      fulfilled: false,
    };
    console.log("Raw Offchain Order:", offchainOrder);

    // Create the order hash to sign
    offchainOrderHash = await marketplace.getOrderHash(offchainOrder);
    console.log("Order Hash:", offchainOrderHash);

    // Call the function to sign the order
    sellerSignature = await signOrder(sellerWallet, offchainOrderHash);

    // NFT scene

    // Define the order data
    offchainNFTOrder = {
      eid: 2,
      buyer: buyerAddress,
      seller: contractAccountAddress,
      toSell: {
        executeAddress: await simpleDAO.getAddress(),
        data: testCalldata,
      },
      toFulfill: {
        asset: azukiAddress,
        ids: [0],
        amountOrTokenIds: [7737],
      },
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiration
      fulfilled: false,
    };
    console.log("Raw Offchain NFT Order:", offchainNFTOrder);

    // Create the order hash to sign
    offchainNFTOrderHash = await marketplace.getOrderHash(offchainNFTOrder);
    console.log("NFT Order Hash:", offchainNFTOrderHash);

    // Call the function to sign the order
    sellerSignatureForNFT = await signOrder(sellerWallet, offchainNFTOrderHash);

    // Define basic order data
    const transferToSellCalldata = getFunctionTriggerCalldata(
      usdc,
      "transferFrom",
      sellerAddress,
      buyerAddress,
      100
    );
    offchainOrderBasic = {
      eid: 3,
      buyer: buyerAddress,
      seller: sellerAddress, //EOA
      toSell: {
        executeAddress: usdcAddress,
        data: transferToSellCalldata,
      },
      toFulfill: {
        asset: highAddress, // high
        ids: [0],
        amountOrTokenIds: [10], // Amount (ERC20) or Token ID (ERC721)
      },
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiration
      fulfilled: false,
    };
    offchainOrderBasicHash = await marketplace.getOrderHash(offchainOrderBasic);
    console.log("Basic Order Hash:", offchainOrderBasicHash);
    sellerSignatureBasic = await signOrder(
      sellerWallet,
      offchainOrderBasicHash
    );

    await setupAllowanceToMarketplace();
    console.log(`All fixtures finished!`);
  }

  describe("Cancel order", function () {
    it("Should off-chain cancel order", async function () {
      const receipt = await cancelOrder(offchainOrder, sellerSignature);
      expect(await marketplace.canceledOrders(offchainOrderHash)).to.be.true;
    });

    it("Should cancel off-chain basic order", async function () {
      const receipt = await cancelOrder(
        offchainOrderBasic,
        sellerSignatureBasic
      );
      expect(await marketplace.canceledOrders(offchainOrderBasicHash)).to.be
        .true;
    });

    it("Should emit OrderCancelled event when an order is cancelled", async function () {
      const result = await cancelOrder(offchainOrder, sellerSignature);
      //console.log("Cancel Result:", result);

      await expect(await cancelOrder(offchainOrder, sellerSignature))
        .to.emit(marketplace, "OrderCancelled")
        .withArgs(offchainOrderHash); // Check that the event is emitted with the correct argument
    });
  });

  describe("Fulfill order", function () {
    it("Should fulfill off-chain order on-chain", async function () {
      // Raw order
      //console.log("Raw Order Data:", offchainOrder);

      // Set up contract account
      await setupContractAccountForDAO(
        sellerAddress,
        contractAccount,
        await simpleDAO.getAddress(),
        usdc,
        usdcInitAmount
      );
      const receipt = await fulfillOrder(offchainOrder, sellerSignature);
      await expect(await marketplace.fulfilledOrders(offchainOrderHash)).to.be
        .true;
    });

    it("Should emit OrderFulfilled event when an order is fulfilled", async function () {
      await setupContractAccountForDAO(
        sellerAddress,
        contractAccount,
        await simpleDAO.getAddress(),
        usdc,
        usdcInitAmount
      );
      await expect(await fulfillOrder(offchainOrder, sellerSignature))
        .to.emit(marketplace, "OrderFulfilled")
        .withArgs(offchainOrderHash, offchainOrder.buyer, 0); // Check that the event is emitted with the correct argument
    });

    it("Should fulfill off-chain NFT order on-chain", async function () {
      // Set up contract account
      await setupContractAccountForDAO(
        sellerAddress,
        contractAccount,
        await simpleDAO.getAddress(),
        usdc,
        usdcInitAmount
      );
      const receipt = await fulfillOrder(
        offchainNFTOrder,
        sellerSignatureForNFT
      );
      await expect(await marketplace.fulfilledOrders(offchainNFTOrderHash)).to
        .be.true;
    });

    it("Should fulfill off-chain basic order on-chain and transfer toSell asset to buyer", async function () {
      await fulfillOrder(offchainOrderBasic, sellerSignatureBasic);
      await expect(await marketplace.fulfilledOrders(offchainOrderBasicHash)).to
        .be.true;
      const usdcBalance = await usdc.balanceOf(buyerAddress);
      await expect(usdcBalance).to.equal(100);
    });
  });

  describe("Function trigger order on-chain", function () {
    it("Should revert when caller is not a contract", async function () {
      await setupContractAccountForDAO(
        sellerAddress,
        contractAccount,
        await simpleDAO.getAddress(),
        usdc,
        usdcInitAmount
      );
      const simpleDAOAddress = await simpleDAO.getAddress();
      await expect(
        contractAccount.execute(
          offchainOrderHash,
          sellerSignature,
          simpleDAOAddress,
          testCalldata,
          0
        )
      ).to.revertedWith("Only contract can execute");
    });
    it("Should vote after fulfilling the order on-chain", async function () {
      await setupContractAccountForDAO(
        sellerAddress,
        contractAccount,
        await simpleDAO.getAddress(),
        usdc,
        usdcInitAmount
      );
      await fulfillOrder(offchainOrder, sellerSignature);
      await expect(await simpleDAO.votes(1)).to.equal(10);
    });

    it("Should revert when the proposal is over threshold", async function () {
      // Set up contract account
      const votingTokenThreshold = await simpleDAO.threshold();
      console.log("Voting Token Threshold:", votingTokenThreshold);

      // Test single vote call with assertion
      await expect(
        simpleDAO.connect(seller).vote(1, votingTokenThreshold + BigInt(1))
      ).to.be.revertedWith("Exceeds voting threshold");
    });
  });

  describe("List order with merkle tree", function () {
    it("Should update merkle root on-chain", async function () {
      const fulfilled = false;
      const tree = await constructingMerkleTree(fulfilled);

      // User confirm to upload the orders to the chain
      await marketplace.connect(seller).updateMerkleRoot(tree.root);

      expect(await marketplace.merkleRoots(sellerAddress)).to.equal(tree.root);
    });
  });

  describe("Cancel order constructed by merkle tree", function () {
    it("Should update merkle root on-chain", async function () {
      const fulfilled = false;
      const tree = await constructingMerkleTree(fulfilled);

      // User confirm to upload the orders to the chain
      await marketplace.connect(seller).updateMerkleRoot(tree.root);

      expect(await marketplace.merkleRoots(sellerAddress)).to.equal(tree.root);
    });
    it("Should cancel all orders on-chain", async function () {
      const fulfilled = false;
      const tree = await constructingMerkleTree(fulfilled);

      // User confirm to upload the orders to the chain
      await marketplace.connect(seller).updateMerkleRoot(tree.root);

      // Cancel all orders
      await marketplace.connect(seller).cancelMerkleOrders();

      await expect(
        fulfillOrderWithMerkleProof(
          offchainOrder,
          sellerSignature,
          tree.getProof(0)
        )
      ).to.be.revertedWith("Invalid merkle proof");
    });
  });

  describe("Fulfill order constructed by merkle tree", function () {
    it("Should fulfill order with merkle proof on-chain", async function () {
      await setupContractAccountForDAO(
        sellerAddress,
        contractAccount,
        await simpleDAO.getAddress(),
        usdc,
        usdcInitAmount
      );
      var fulfilled = false;
      const tree = await constructingMerkleTree(fulfilled);

      console.log("merkle tree: ", tree);
      console.log("input orderhash: ", offchainOrderHash);
      console.log("arrayfy Order: ", flattenOrder(offchainOrder, 0));

      // User confirm to upload the orders to the chain
      await marketplace.connect(seller).updateMerkleRoot(tree.root);
      expect(await marketplace.merkleRoots(sellerAddress)).to.equal(tree.root);

      // fulfill
      const fulfillTx = await fulfillOrderWithMerkleProof(
        offchainOrder,
        sellerSignature,
        await searchProof(tree, flattenOrder(offchainOrder, 0))
      );
      //console.log("fulfill tx: ", fulfillTx);

      expect(await marketplace.fulfilledOrders(offchainOrderHash)).to.be.true;
    });
  });

  describe("Sweep order", function () {
    it("Should fulfill multiple orders with sweepOrders", async function () {
      const orders = setupSweepOrders();

      // Mock seller's signatures (assume we have a recoverSigner function)
      let orderHashes = [];
      let signatures = [];

      for (let i = 0; i < orders.length; i++) {
        const orderHash = await marketplace.getOrderHashBasic(orders[i]);
        const signature = await signOrder(sellerWallet, orderHash);
        orderHashes.push(orderHash);
        signatures.push(signature);
      }

      // Set up price and fees in Oracle mock
      const PLATFORM_FEE_BPS = 5;
      const FACTOR = 100;
      const priceInETH = Number(ethers.parseEther("0.01")); // 0.01 ETH price for TKB
      const totalPlatformFee =
        ((priceInETH * (PLATFORM_FEE_BPS * FACTOR)) / (100 * FACTOR)) *
        orders.length;

      // Execute sweepOrders and verify balances
      await expect(
        marketplace
          .connect(buyer)
          .sweepOrders(orders, signatures, { value: totalPlatformFee })
      )
        .to.emit(marketplace, "OrderFulfilled")
        .withArgs(orderHashes[0], buyer.address, 0)
        .and.emit(marketplace, "OrderFulfilled")
        .withArgs(orderHashes[1], buyer.address, 0)
        .and.emit(marketplace, "OrderFulfilled")
        .withArgs(orderHashes[2], buyer.address, 0)
        .and.emit(marketplace, "OrderFulfilled")
        .withArgs(orderHashes[3], buyer.address, 0);

      console.log("buyer HIGH balance: ", await high.balanceOf(buyer.address));
      console.log("buyer USDC balance: ", await usdc.balanceOf(buyer.address));

      console.log(
        "seller HIGH balance after sweeping orders: ",
        await high.balanceOf(seller.address)
      );
      console.log(
        "seller USDC balance after sweeping orders: ",
        await usdc.balanceOf(seller.address)
      );
      // Check buyer's token balance
      const buyerUSDCBalance = await usdc.balanceOf(buyer.address);
      const buyerBAYCBalance = await bayc.balanceOf(buyer.address);
      const buyerGOLDBalance = await gameItems.balanceOf(buyer.address, 1);
      const buyerSILVERBalance = await gameItems.balanceOf(buyer.address, 2);
      const buyerTHORSHAMMERBalance = await gameItems.balanceOf(
        buyer.address,
        3
      );
      expect(buyerUSDCBalance).to.equal(300);
      expect(buyerBAYCBalance).to.equal(1);
      expect(buyerGOLDBalance).to.equal(100);
      expect(buyerSILVERBalance).to.equal(100);
      expect(buyerTHORSHAMMERBalance).to.equal(1);
      console.log(
        `buyer USDC balance: ${buyerUSDCBalance}, buyer BAYC balance: ${buyerBAYCBalance}, buyer GOLD balance: ${buyerGOLDBalance}, buyer SILVER balance: ${buyerSILVERBalance}, buyer THORSHAMMER balance: ${buyerTHORSHAMMERBalance}`
      );
      // Check seller's token balance
      const sellerHIGHBalance = await high.balanceOf(seller.address);
      expect(sellerHIGHBalance).to.equal(50);
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
        ownerWallet.address
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

      const ownerBalanceAfter = await ethers.provider.getBalance(
        ownerWallet.address
      );
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
  async function searchProof(tree: StandardMerkleTree<any>, target: any) {
    var proof;
    for (const [i, v] of tree.entries()) {
      const leafHash = ethers.solidityPackedKeccak256(getLeafEncoding(), v);
      console.log(`leaf hash${i}: ${leafHash}`);
      const targetHash = ethers.solidityPackedKeccak256(
        getLeafEncoding(),
        target
      );
      console.log(`target hash: ${targetHash}`);
      if (leafHash === targetHash) {
        console.log(`found proof: ${i}`);
        proof = tree.getProof(i);
        break;
      }
    }
    return proof;
  }

  // Call the contract's cancel function
  async function cancelOrder(order: any, sellerSignature: any) {
    const tx = await marketplace.cancelOrder(order, sellerSignature);

    console.log("Transaction hash:", tx.hash);
    await tx.wait(); // Wait for the transaction to be mined
    console.log("Order cancelled!");
    return tx;
  }

  // Call the contract's fulfillOffchainOrder function
  async function fulfillOrder(order: any, sellerSignature: any) {
    //await setupAllowanceToMarketplace();
    const tx = await marketplace.fulfillOffchainOrder(order, sellerSignature, {
      value: ethers.parseEther("0.1"), // Example value for payment
    });

    console.log("Transaction hash:", tx.hash);
    await tx.wait(); // Wait for the transaction to be mined
    console.log("Order fulfilled!");
    return tx;
  }
  async function fulfillOrderWithMerkleProof(
    order: any,
    sellerSignature: any,
    proof: any
  ) {
    //await setupAllowanceToMarketplace();
    const tx = await marketplace.fulfillOffchainOrderWithMerkleProof(
      order,
      sellerSignature,
      proof,
      {
        value: ethers.parseEther("0.1"),
      }
    );

    console.log("Transaction hash:", tx.hash);
    await tx.wait(); // Wait for the transaction to be mined
    console.log("Order fulfilled with merkle proof!");
    return tx;
  }
  // Sign the order hash with the seller's private key
  async function signOrder(wallet: any, orderHash: any) {
    const signature = await wallet.signMessage(ethers.toBeArray(orderHash));
    console.log("Signed Order Signature:", signature);
    return signature;
  }

  async function setupAllowanceToMarketplace() {
    const marketplaceAddress = await marketplace.getAddress();

    await usdc
      .connect(seller)
      .approve(marketplaceAddress, await usdc.balanceOf(sellerAddress));
    await high
      .connect(buyer)
      .approve(marketplaceAddress, await high.balanceOf(buyerAddress));

    await bayc.connect(seller).setApprovalForAll(marketplaceAddress, true);
    await azuki.connect(buyer).setApprovalForAll(marketplaceAddress, true);
    await gameItems.connect(seller).setApprovalForAll(marketplaceAddress, true);

    console.log(
      `Marketplace USDC allowance of seller: ${await usdc.allowance(
        sellerAddress,
        marketplaceAddress
      )}`
    );
    console.log(
      `Marketplace HIGH allowance of buyer: ${await high.allowance(
        buyerAddress,
        marketplaceAddress
      )}`
    );
  }

  async function setupContractAccountForDAO(
    owner: AddressLike,
    contractAccount: ContractAccount,
    executeAddress: AddressLike,
    votingToken: IERC20,
    amount: any
  ) {
    await contractAccount.addVotingToken(
      await simpleDAO.getAddress(),
      votingToken,
      false
    );
    console.log(
      `Voting Token address in Contract Account: ${await contractAccount
        .connect(seller)
        .votingTokens(await simpleDAO.getAddress())}`
    );

    // Deposit voting tokens in his own account
    await votingToken.connect(seller).transfer(contractAccount, amount);

    // Check amount in CA
    console.log(
      `USDC in Contract Account: ${await usdc.balanceOf(
        await contractAccount.getAddress()
      )}`
    );

    // Approve the contract account
    await contractAccount
      .connect(seller)
      .approveVotingToken(executeAddress, amount, 0);

    // Check
    console.log(
      `ContractAccount's allowance to executeAddress: ${await votingToken.allowance(
        contractAccount,
        executeAddress
      )},`
    );
  }
  async function setupContractAccountForDAOV2(
    owner: AddressLike,
    contractAccount: ContractAccount,
    executeAddress: AddressLike,
    votingToken: IERC20,
    amount: any,
    id: any
  ) {
    await contractAccount.addVotingToken(
      await simpleDAO.getAddress(),
      votingToken,
      false
    );
    console.log(
      `Voting Token address in Contract Account: ${await contractAccount
        .connect(seller)
        .votingTokens(await simpleDAO.getAddress())}`
    );

    // Deposit voting tokens in his own account
    await votingToken.connect(seller).transfer(contractAccount, amount);

    // Check amount in CA
    console.log(
      `USDC in Contract Account: ${await usdc.balanceOf(
        await contractAccount.getAddress()
      )}`
    );

    // Approve the contract account
    await contractAccount
      .connect(seller)
      .approveVotingToken(executeAddress, amount, id);

    // Check
    console.log(
      `ContractAccount's allowance to executeAddress: ${await votingToken.allowance(
        contractAccount,
        executeAddress
      )},`
    );
  }

  async function constructingMerkleTree(fulfilled: boolean) {
    const orders = fulfilled
      ? await setupFulfilledOrders()
      : await setup10NewOrders(); // Assume this returns an array of `order` objects

    const leaves = orders.map((order) => [
      order.eid,
      order.buyer,
      order.seller,
      order.toSell.executeAddress,
      order.toSell.data,
      order.toFulfill.asset,
      order.toFulfill.ids[0],
      order.toFulfill.amountOrTokenIds[0],
      order.deadline,
      order.fulfilled,
    ]);
    const tree = StandardMerkleTree.of(leaves, getLeafEncoding());
    return tree;
  }
  function getLeafEncoding() {
    return [
      "uint256",
      "address",
      "address",
      "address",
      "bytes",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "bool",
    ];
  }
  async function setup10NewOrders() {
    let orders = [];
    for (let i = 0; i < 10; i++) {
      const order = {
        eid: i + 1,
        buyer: buyerAddress,
        seller: contractAccountAddress,
        toSell: {
          executeAddress: await simpleDAO.getAddress(),
          data: testCalldata,
        },
        toFulfill: {
          asset: highAddress, // high
          ids: [0],
          amountOrTokenIds: [10], // Amount (ERC20) or Token ID (ERC721)
        },
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiration
        fulfilled: false,
      };

      orders.push(order);
    }
    return orders;
  }
  async function setupFulfilledOrders() {
    let orders = [];
    for (let i = 0; i < 4; i++) {
      const order = {
        eid: i + 1,
        buyer: buyerAddress,
        seller: contractAccountAddress,
        toSell: {
          executeAddress: await simpleDAO.getAddress(),
          data: testCalldata,
        },
        toFulfill: {
          asset: highAddress, // high
          ids: [0],
          amountOrTokenIds: [10], // Amount (ERC20) or Token ID (ERC721)
        },
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiration
        fulfilled: true,
      };

      orders.push(order);
    }
    return orders;
  }

  function flattenOrder(order: any, id: number) {
    const flattenOrder = [
      order.eid,
      order.buyer,
      order.seller,
      order.toSell.executeAddress,
      order.toSell.data,
      order.toFulfill.asset,
      order.toFulfill.ids[id],
      order.toFulfill.amountOrTokenIds[id],
      order.deadline,
      order.fulfilled,
    ];
    return flattenOrder;
  }

  function getFunctionTriggerCalldata(
    executeContract: any,
    functionName: string,
    param1?: any,
    param2?: any,
    param3?: any
  ) {
    console.log(
      `executeContract: ${executeContract.interface.name}, function: ${functionName}, param1: ${param1}, param2: ${param2}, param3: ${param3}`
    );

    // Create an empty array for the function arguments
    let args: any[] = [];

    // Conditionally add parameters if they are not undefined or null
    if (param1 !== undefined && param1 !== null) {
      args.push(param1);
    }
    if (param2 !== undefined && param2 !== null) {
      args.push(param2);
    }
    if (param3 !== undefined && param3 !== null) {
      args.push(param3);
    }

    // Encode the function call with the dynamically constructed arguments array
    const calldata = executeContract.interface.encodeFunctionData(
      functionName,
      args
    );

    console.log("getFunctionTriggerCalldata:", calldata);
    return calldata;
  }
  function setupSweepOrders() {
    // ERC20
    const order1 = {
      eid: 1,
      buyer: buyer.address,
      seller: seller.address,
      toSell: {
        asset: usdcAddress,
        ids: [0],
        amountOrTokenIds: [200],
      },
      toFulfill: {
        asset: highAddress,
        ids: [0],
        amountOrTokenIds: [20],
      },
      deadline: Math.floor(Date.now() / 1000) + 3600,
      fulfilled: false,
    };
    // ERC20
    const order2 = {
      eid: 2,
      buyer: buyer.address,
      seller: seller.address,
      toSell: {
        asset: usdcAddress,
        ids: [0],
        amountOrTokenIds: [100],
      },
      toFulfill: {
        asset: highAddress,
        ids: [0],
        amountOrTokenIds: [10],
      },
      deadline: Math.floor(Date.now() / 1000) + 3600,
      fulfilled: false,
    };
    // ERC721
    const order3 = {
      eid: 3,
      buyer: buyer.address,
      seller: seller.address,
      toSell: {
        asset: baycAddress,
        ids: [0],
        amountOrTokenIds: [2464],
      },
      toFulfill: {
        asset: highAddress,
        ids: [0],
        amountOrTokenIds: [10],
      },
      deadline: Math.floor(Date.now() / 1000) + 3600,
      fulfilled: false,
    };
    // ERC1155
    const order4 = {
      eid: 4,
      buyer: buyer.address,
      seller: seller.address,
      toSell: {
        asset: gameItemsAddress,
        ids: [1, 2, 3],
        amountOrTokenIds: [100, 100, 1],
      },
      toFulfill: {
        asset: highAddress,
        ids: [0],
        amountOrTokenIds: [10],
      },
      deadline: Math.floor(Date.now() / 1000) + 3600,
      fulfilled: false,
    };
    return [order1, order2, order3, order4];
  }
});
