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
  let gameItems: any;
  let sellerAddress: AddressLike;
  let sellerWallet: any;
  let sellerSignature: any;
  let sellerSignatureForNFT: any;
  let buyerAddress: AddressLike;
  let buyerWallet: any;
  let highAddress: AddressLike;
  let usdcAddress: AddressLike;
  let baycAddress: AddressLike;
  let azukiAddress: AddressLike;
  let testCalldata: any;
  let offchainOrder: any;
  let offchainOrderHash: any;
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
    console.log("seller address:", sellerWallet.address);
    console.log("buyer address:", buyerWallet.address);

    // Address
    sellerAddress = await sellerWallet.address;
    buyerAddress = await buyerWallet.address;

    // Signer
    seller = await ethers.getSigner(sellerWallet.address);
    buyer = await ethers.getSigner(buyerWallet.address);

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
    const Marketplace = await ethers.getContractFactory("Marketplace");
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
    };

    console.log("const new proposal:", proposal);
    await simpleDAO.submitProposal(proposal);
    const proposalId = 1;
    const defaultProposal = await simpleDAO.proposals(proposalId);
    console.log("proposal on-chain created:", defaultProposal);
  }
  async function deploySimpleDAOV2Fixture() {
    const SimpleDAOV2 = await ethers.getContractFactory("SimpleDAOV2", seller);
    simpleDAOV2 = await SimpleDAOV2.deploy(
      gameItems,
      0, //use GOLD as voting amount
      gameItems.totalSupplies(0)
    );
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

    initHighBalance != 0
      ? await high
          .connect(highWhale)
          .transfer(buyerAddress, highInitAmount - initHighBalance)
      : await high.connect(highWhale).transfer(buyerAddress, highInitAmount);

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

    // Transfer GOLD to seller for voting
    await gameItems.transfer();
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

    //console.log("Offchain-gen trigger external calldata:", testCalldata);

    // Define the order data
    offchainOrder = {
      eid: 1,
      buyer: buyerAddress,
      contractAccount: contractAccountAddress,
      toSell: {
        daoAddress: await simpleDAO.getAddress(),
        data: testCalldata,
      },
      toFulfill: {
        asset: highAddress, // high
        amountOrTokenId: 10, // Amount (ERC20) or Token ID (ERC721)
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
      contractAccount: contractAccountAddress,
      toSell: {
        daoAddress: await simpleDAO.getAddress(),
        data: testCalldata,
      },
      toFulfill: {
        asset: azukiAddress,
        amountOrTokenId: 7737,
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

    setupAllowanceToMarketplace();
    console.log(`All fixtures finished!`);
  }

  describe("Cancel order", function () {
    it("Should off-chain cancel order", async function () {
      const receipt = await cancelOrder(offchainOrder, sellerSignature);
      //console.log("Receipt:", receipt);

      expect(await marketplace.canceledOrders(offchainOrderHash)).to.be.true;
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

  describe("Function trigger order on-chain V2", function () {
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
      await marketplace.connect(seller).cancelAllOrders();

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

      // console.log("merkle tree: ", tree);
      // console.log("input orderhash: ", offchainOrderHash);
      // console.log("arrayfy Order: ", flattenOrder(offchainOrder));

      // User confirm to upload the orders to the chain
      await marketplace.connect(seller).updateMerkleRoot(tree.root);
      expect(await marketplace.merkleRoots(sellerAddress)).to.equal(tree.root);

      // fulfill
      const fulfillTx = await fulfillOrderWithMerkleProof(
        offchainOrder,
        sellerSignature,
        await searchProof(tree, flattenOrder(offchainOrder))
      );
      //console.log("fulfill tx: ", fulfillTx);

      expect(await marketplace.fulfilledOrders(offchainOrderHash)).to.be.true;
    });
  });

  describe("Sweep order", function () {
    it("Should fulfill multiple orders with sweepOrders", async function () {
      const orders = setupSweepOrders();

      // Mock seller's signatures (assume we have a recoverSigner function)
      const order1Hash = await marketplace.getOrderHashBasic(orders[0]);
      const order2Hash = await marketplace.getOrderHashBasic(orders[1]);

      const sellerSignature1 = await signOrder(sellerWallet, order1Hash);
      const sellerSignature2 = await signOrder(sellerWallet, order2Hash);

      const signatures = [sellerSignature1, sellerSignature2];

      // Set up price and fees in Oracle mock
      const PLATFORM_FEE_BPS = 5;
      const FACTOR = 100;
      const priceInETH = Number(ethers.parseEther("0.01")); // 0.01 ETH price for TKB
      const totalPlatformFee =
        ((priceInETH * (PLATFORM_FEE_BPS * FACTOR)) / (100 * FACTOR)) *
        orders.length;
      // Approve marketplace to transfer tokens on behalf of buyer and seller
      const marketplaceAddress = await marketplace.getAddress();
      await high.connect(buyer).approve(marketplaceAddress, "30");
      await usdc.connect(seller).approve(marketplaceAddress, "300");

      // Execute sweepOrders and verify balances
      await expect(
        marketplace
          .connect(buyer)
          .sweepOrders(orders, signatures, { value: totalPlatformFee })
      )
        .to.emit(marketplace, "OrderFulfilled")
        .withArgs(order1Hash, buyer.address, 0)
        .and.emit(marketplace, "OrderFulfilled")
        .withArgs(order2Hash, buyer.address, 0);

      console.log("buyer HIGH balance: ", await high.balanceOf(buyer.address));
      console.log("buyer USDC balance: ", await usdc.balanceOf(buyer.address));

      console.log(
        "seller HIGH balance: ",
        await high.balanceOf(seller.address)
      );
      console.log(
        "seller USDC balance: ",
        await usdc.balanceOf(seller.address)
      );
      // Check buyer's token balance
      const buyerUSDCBalance = await usdc.balanceOf(buyer.address);
      expect(buyerUSDCBalance).to.equal(300);

      // Check seller's token balance
      const sellerHIGHBalance = await high.balanceOf(seller.address);
      expect(sellerHIGHBalance).to.equal(30);
    });
  });

  async function searchProof(tree: StandardMerkleTree<any>, target: any) {
    var proof;
    for (const [i, v] of tree.entries()) {
      const leafHash = ethers.solidityPackedKeccak256(getLeafEncoding(), v);
      const targetHash = ethers.solidityPackedKeccak256(
        getLeafEncoding(),
        target
      );
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
    await setupAllowanceToMarketplace();
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
    await setupAllowanceToMarketplace();
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
    await usdc
      .connect(await ethers.getSigner(sellerWallet.address))
      .approve(marketplace.getAddress(), await usdc.balanceOf(seller));
    await high
      .connect(await ethers.getSigner(buyerWallet.address))
      .approve(marketplace.getAddress(), await high.balanceOf(buyer));

    await bayc
      .connect(seller)
      .setApprovalForAll(marketplace.getAddress(), true);
    await azuki
      .connect(buyer)
      .setApprovalForAll(marketplace.getAddress(), true);
  }

  async function setupContractAccountForDAO(
    owner: AddressLike,
    contractAccount: ContractAccount,
    daoAddress: AddressLike,
    votingToken: IERC20,
    amount: any
  ) {
    await contractAccount.addVotingToken(
      await simpleDAO.getAddress(),
      votingToken
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
      .approveVotingToken(daoAddress, amount);

    // Check
    console.log(
      `ContractAccount's allowance to daoAddress: ${await votingToken.allowance(
        contractAccount,
        daoAddress
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
      order.contractAccount,
      order.toSell.daoAddress,
      order.toSell.data,
      order.toFulfill.asset,
      order.toFulfill.amountOrTokenId,
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
      "bool",
    ];
  }
  async function setup10NewOrders() {
    let orders = [];
    for (let i = 0; i < 10; i++) {
      const order = {
        eid: i + 1,
        buyer: buyerAddress,
        contractAccount: contractAccountAddress,
        toSell: {
          daoAddress: await simpleDAO.getAddress(),
          data: testCalldata,
        },
        toFulfill: {
          asset: highAddress, // high
          amountOrTokenId: 10, // Amount (ERC20) or Token ID (ERC721)
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
        contractAccount: contractAccountAddress,
        toSell: {
          daoAddress: await simpleDAO.getAddress(),
          data: testCalldata,
        },
        toFulfill: {
          asset: highAddress, // high
          amountOrTokenId: 10, // Amount (ERC20) or Token ID (ERC721)
        },
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1-hour expiration
        fulfilled: true,
      };

      orders.push(order);
    }
    return orders;
  }

  function flattenOrder(order: any) {
    const flattenOrder = [
      order.eid,
      order.buyer,
      order.contractAccount,
      order.toSell.daoAddress,
      order.toSell.data,
      order.toFulfill.asset,
      order.toFulfill.amountOrTokenId,
      order.deadline,
      order.fulfilled,
    ];
    return flattenOrder;
  }
  function getFunctionTriggerCalldata(
    executeContract: any,
    functionName: string,
    proposalId?: any,
    amount?: any
  ) {
    console.log(
      `executeContract: ${executeContract.interface.name}, function: ${functionName}, proposalId: ${proposalId}, amount: ${amount}`
    );

    // Create an empty array for the function arguments
    let args: any[] = [];

    // Conditionally add parameters if they are not undefined or null
    if (proposalId !== undefined && proposalId !== null) {
      args.push(proposalId);
    }
    if (amount !== undefined && amount !== null) {
      args.push(amount);
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
    const order1 = {
      eid: 1,
      buyer: buyer.address,
      seller: seller.address,
      toSell: {
        asset: usdcAddress,
        amountOrTokenId: 200,
      },
      toFulfill: {
        asset: highAddress, // high
        amountOrTokenId: 20, // Amount (ERC20) or Token ID (ERC721)
      },
      deadline: Math.floor(Date.now() / 1000) + 3600,
      fulfilled: false,
    };

    const order2 = {
      eid: 2,
      buyer: buyer.address,
      seller: seller.address,
      toSell: {
        asset: usdcAddress,
        amountOrTokenId: 100,
      },
      toFulfill: {
        asset: highAddress, // high
        amountOrTokenId: 10, // Amount (ERC20) or Token ID (ERC721)
      },
      deadline: Math.floor(Date.now() / 1000) + 3600,
      fulfilled: false,
    };
    return [order1, order2];
  }
});
