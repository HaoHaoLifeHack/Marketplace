import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import { TEST_CONFIG } from "../util/testConfig";

dotenvConfig({ path: "./.env" });
export async function deployMarketplace() {
  const owner = await ethers.getSigner(TEST_CONFIG.SIGNER_ADDRESSES.OWNER);
  const seller = await ethers.getSigner(TEST_CONFIG.SIGNER_ADDRESSES.SELLER);
  const buyer = await ethers.getSigner(TEST_CONFIG.SIGNER_ADDRESSES.BUYER);

  // Deploy OracleHandler
  const OracleHandler = await ethers.getContractFactory("OracleHandler", owner);
  const oracleHandler = await OracleHandler.deploy(TEST_CONFIG.PRICE_FEEDS.USDC_ETH, {
    // gasLimit: 30000000,
    // maxFeePerGas: ethers.parseUnits("20000", "gwei"), // Set higher maxFeePerGas
  });
  // Deploy Mock NFT Price Feed
  const MockNFTPriceFeed = await ethers.getContractFactory("NFTPriceFeed");
  const mockNFTPriceFeed = await MockNFTPriceFeed.deploy();

  // Deploy Marketplace contract
  const Marketplace = await ethers.getContractFactory("Marketplace", owner);
  const marketplace = await Marketplace.deploy(oracleHandler);

  // Setup token contracts
  const high = await ethers.getContractAt("IERC20", TEST_CONFIG.TOKEN_ADDRESSES.HIGH);
  const usdc = await ethers.getContractAt("IERC20", TEST_CONFIG.TOKEN_ADDRESSES.USDC);
  const bayc = await ethers.getContractAt("IERC721", TEST_CONFIG.TOKEN_ADDRESSES.BAYC);
  const azuki = await ethers.getContractAt("IERC721", TEST_CONFIG.TOKEN_ADDRESSES.AZUKI);
  const MockERC1155 = await ethers.getContractFactory("GameItems", seller);
  const mockERC1155 = await MockERC1155.deploy();

  // Deploy ContractAccount (for contract-based seller testing)
  const ContractAccount = await ethers.getContractFactory("ContractAccount", seller);
  const contractAccount = await ContractAccount.deploy();

  // Deploy Mock DAO contract
  const SimpleDAO = await ethers.getContractFactory("SimpleDAO", owner);
  const simpleDAO = await SimpleDAO.deploy(await usdc.getAddress(), await usdc.totalSupply());

  return {
    owner,
    seller,
    buyer,
    oracleHandler,
    mockNFTPriceFeed,
    marketplace,
    high,
    usdc,
    bayc,
    azuki,
    mockERC1155,
    contractAccount,
    simpleDAO,
  };
}
