import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMarketplace } from "../deployer/deployMarketplace";
import { setupTestEnvironment, setETHBalance } from "../deployer/setupTestEnv";
import { getOrderSignature } from "../util/signature";
import { Marketplace, OracleHandler, NFTPriceFeed, ContractAccount, SimpleDAO, GameItems, IPriceFeed } from "../../typechain-types";
import { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { IERC721 } from "../../typechain-types/@openzeppelin/contracts/token/ERC721/IERC721";
import { getOrderHash } from "../util/signature";
import { getFunctionTriggerCalldata, getTriggerOrder } from "../util/helpers";
import { TEST_CONFIG } from "../util/testConfig";

describe("Function trigger test", function () {
  let owner: any,
    seller: any,
    buyer: any,
    usdc: IERC20,
    high: IERC20,
    marketplace: Marketplace,
    oracleHandler: OracleHandler,
    contractAccount: ContractAccount,
    simpleDAO: SimpleDAO,
    mockNFTPriceFeed: IPriceFeed;
  let offchainOrder: any;
  let sellerSignature: any;
  let offchainOrderHash: any;

  beforeEach(async () => {
    ({ owner, seller, buyer, marketplace, oracleHandler, usdc, high, contractAccount, simpleDAO, mockNFTPriceFeed } = await setupTestEnvironment());
    // Prepare an order to trigger task
    const proposalId = 1;
    const amount = 10;
    const toSell = {
      executeAddress: await simpleDAO.getAddress(),
      data: getFunctionTriggerCalldata(simpleDAO, "vote", proposalId, amount),
    };
    const toFulfill = { asset: await high.getAddress(), ids: [0], amountOrTokenIds: [10] };
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Prepare offchain order, signature, and hash for both tests
    offchainOrder = getTriggerOrder(await buyer.getAddress(), await contractAccount.getAddress(), toSell, toFulfill, deadline, false);
    offchainOrderHash = getOrderHash(offchainOrder);
    const signer = TEST_CONFIG.SIGNER_ADDRESSES.SELLER;
    sellerSignature = await getOrderSignature(offchainOrder, signer);
  });

  describe("Withdraw", function () {
    it("Should allow the owner to withdraw platform fees", async function () {
      // Simulate sending some ETH as platform fees to the contract
      await setETHBalance(await marketplace.getAddress(), ethers.parseEther("10"));

      const marketplaceAddress = await marketplace.getAddress();
      const platformFee = await ethers.provider.getBalance(await marketplace.getAddress());
      console.log(`Current Platform fee: ${platformFee}`);
      const contractBalanceBefore = await ethers.provider.getBalance(marketplaceAddress);
      console.log(`Contract balance before withdrawal: ${contractBalanceBefore}`);

      // Check that the owner's balance increased (considering gas fees)
      const ownerBalanceBefore = await ethers.provider.getBalance(TEST_CONFIG.SIGNER_ADDRESSES.OWNER);

      // Withdraw funds by the owner
      await marketplace.connect(owner).withdraw();

      // Check that the contract's balance is now 0 after withdrawal
      const contractBalanceAfterWithdraw = await ethers.provider.getBalance(marketplaceAddress);
      expect(contractBalanceAfterWithdraw).to.equal(0);

      const ownerBalanceAfter = await ethers.provider.getBalance(TEST_CONFIG.SIGNER_ADDRESSES.OWNER);
      // Ensure the owner's balance increased correctly by the platform fee amount minus gas
      expect(ownerBalanceAfter).to.be.above(ownerBalanceBefore);
    });
    it("Should emit Withdraw event when owner withdraw", async function () {
      // Simulate sending some ETH as platform fees to the contract
      await setETHBalance(await marketplace.getAddress(), ethers.parseEther("10"));
      // Withdraw funds by the owner
      const tx = await marketplace.connect(owner).withdraw();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;
      await expect(tx).to.emit(marketplace, "Withdraw").withArgs(owner.address, ethers.parseEther("10"), timestamp);
    });

    it("Should not allow non-owners to withdraw", async function () {
      // Simulate sending some ETH as platform fees to the contract
      await setETHBalance(await marketplace.getAddress(), ethers.parseEther("10"));

      // Try to call withdraw from a non-owner account
      await expect(marketplace.connect(buyer).withdraw()).to.be.revertedWith("Only owner can call this function");
    });

    it("Should revert if there is no balance to withdraw", async function () {
      // withdraw funds by the owner first
      marketplace.withdraw();
      // Try to call withdraw the second time
      await expect(marketplace.withdraw()).to.be.revertedWith("No balance to withdraw");
    });
  });
  describe("OracleHandler", function () {
    it("Should get the correct latest price in ETH by OracleHandler", async function () {
      const highUsdPriceFeed = await ethers.getContractAt("IPriceFeed", TEST_CONFIG.PRICE_FEEDS.HIGH_USD);
      const usdcEthPriceFeed = await ethers.getContractAt("IPriceFeed", TEST_CONFIG.PRICE_FEEDS.USDC_ETH);
      const assetDecimals = await highUsdPriceFeed.decimals();
      var highEthPrice = ((await highUsdPriceFeed.latestAnswer()) * (await usdcEthPriceFeed.latestAnswer())) / BigInt(10) ** assetDecimals;

      console.log(`highUsdPrice latestAnswer: ${await highUsdPriceFeed.latestAnswer()}, decimals: ${await highUsdPriceFeed.decimals()}`);
      console.log(`usdcEthPrice latestAnswer: ${await usdcEthPriceFeed.latestAnswer()}, decimals: ${await usdcEthPriceFeed.decimals()}`);

      const price = await oracleHandler.getLatestPriceInETH(TEST_CONFIG.TOKEN_ADDRESSES.HIGH);
      expect(highEthPrice).to.equal(price);
    });

    it("Should revert when priceFeed is the zero address in setChainlinkPriceFeed", async function () {
      const asset = TEST_CONFIG.TOKEN_ADDRESSES.USDC;
      const zeroAddress = ethers.ZeroAddress;
      await expect(oracleHandler.setChainlinkPriceFeed(asset, zeroAddress, false)).to.be.revertedWith("Invalid price feed address");
    });

    it("Should revert when priceFeedAddress is not set in getLatestPriceInETH", async function () {
      const asset = ethers.ZeroAddress;
      await expect(oracleHandler.getLatestPriceInETH(asset)).to.be.revertedWith("Invalid price feed address");
    });
  });
});
