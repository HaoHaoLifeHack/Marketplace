import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const deployMarketplace: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("Deploying OracleHandler...");

  // Deploy the OracleHandler contract
  const USDC_ETH_PRICEFEED_ADDRESS =
    "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";
  const oracleHandlerDeployment = await deploy("OracleHandler", {
    from: deployer,
    args: [USDC_ETH_PRICEFEED_ADDRESS],
    log: true,
  });

  log(`OracleHandler deployed at ${oracleHandlerDeployment.address}`);

  log("Deploying Marketplace...");

  // Deploy the Marketplace contract, passing the OracleHandler address
  const marketplaceDeployment = await deploy("Marketplace", {
    from: deployer,
    args: [oracleHandlerDeployment.address], // Pass the deployed OracleHandler address to the Marketplace contract
    log: true,
  });

  log(`Marketplace deployed at ${marketplaceDeployment.address}`);
};

export default deployMarketplace;
deployMarketplace.tags = ["Marketplace"];
