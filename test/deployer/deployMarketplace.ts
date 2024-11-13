import { ethers, network } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import { TEST_CONFIG } from "../util/testConfig";

dotenvConfig({ path: "./.env" });
export async function deployMarketplace() {
  await forkMainnet();
  const owner = await ethers.getSigner(TEST_CONFIG.SIGNER_ADDRESSES.OWNER);
  const seller = await ethers.getSigner(TEST_CONFIG.SIGNER_ADDRESSES.SELLER);
  const buyer = await ethers.getSigner(TEST_CONFIG.SIGNER_ADDRESSES.BUYER);

  // Deploy WETH
  const WETH = await ethers.getContractFactory("WETH");
  const weth = await WETH.deploy();

  // Deploy OracleHandler
  const OracleHandler = await ethers.getContractFactory("OracleHandler", owner);
  const oracleHandler = await OracleHandler.deploy(TEST_CONFIG.PRICE_FEEDS.USDC_ETH, await weth.getAddress(), {
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

  // Deploy DAO contract
  const SimpleDAO = await ethers.getContractFactory("SimpleDAO", owner);
  const simpleDAO = await SimpleDAO.deploy(await usdc.getAddress(), 10000);
  const SimpleDAOV2 = await ethers.getContractFactory("SimpleDAOV2", owner);
  const simpleDAOV2 = await SimpleDAOV2.deploy(await mockERC1155.getAddress(), 0, 10000);

  return {
    owner,
    seller,
    buyer,
    oracleHandler,
    mockNFTPriceFeed,
    marketplace,
    high,
    usdc,
    weth,
    bayc,
    azuki,
    mockERC1155,
    contractAccount,
    simpleDAO,
    simpleDAOV2,
  };
}

const forkMainnet = async () => {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
          blockNumber: 20910716,
        },
      },
    ],
  });
};
