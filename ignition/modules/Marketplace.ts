import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Step 0: Define module
export default buildModule("MarketplaceDeployment", (m) => {
  // Step 1: Deploy OracleHandler contract
  const oracleHandler = m.contract("OracleHandler");

  // Step 2: Deploy Marketplace contract with OracleHandler dependency
  const marketplace = m.contract("Marketplace", {
    args: [oracleHandler],
  });

  // Optional: Return deployed contracts for later access in scripts or tests
  return { oracleHandler, marketplace };
});
