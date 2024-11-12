import { ethers } from "hardhat";
import { TEST_CONFIG } from "./testConfig";

//Converts an amount to a specific number of decimal places based on the token's decimal value.
export function convertToDecimals(amount: string | number, decimals: number): string {
  const factor = 10 ** decimals;
  return ethers.parseUnits(amount.toString(), decimals).toString();
}

// Helper function to create a trigger order object.
export function getTriggerOrder(
  buyer: string,
  seller: string,
  toSell: { executeAddress: string; data: string },
  toFulfill: { asset: string; ids?: number[]; amountOrTokenIds: number[] },
  expiryDurationInSeconds: number = 3600, // Default 1-hour expiration
  fulfilled: boolean
) {
  return {
    eid: Math.floor(Math.random() * 1e6), // Generates a random ID
    buyer,
    seller,
    toSell: {
      executeAddress: toSell.executeAddress,
      data: toSell.data,
    },
    toFulfill: {
      asset: toFulfill.asset,
      ids: toFulfill.ids || [0],
      amountOrTokenIds: toFulfill.amountOrTokenIds, // Use amount or token IDs as needed
    },
    deadline: Math.floor(Date.now() / 1000) + expiryDurationInSeconds, // Set expiration
    fulfilled: fulfilled,
  };
}

export function getBasicOrder(
  buyer: string,
  seller: string,
  toSell: { asset: string; ids?: number[]; amountOrTokenIds: number[] },
  toFulfill: { asset: string; ids?: number[]; amountOrTokenIds: number[] },
  expiryDurationInSeconds: number = 3600,
  fulfilled: boolean
) {
  return {
    eid: Math.floor(Math.random() * 1e6), // Generates a random ID
    buyer,
    seller,
    toSell: {
      asset: toSell.asset,
      ids: toSell.ids || [0],
      amountOrTokenIds: toSell.amountOrTokenIds, // Use amount or token IDs as needed
    },
    toFulfill: {
      asset: toFulfill.asset,
      ids: toFulfill.ids || [0],
      amountOrTokenIds: toFulfill.amountOrTokenIds, // Use amount or token IDs as needed
    },
    deadline: Math.floor(Date.now() / 1000) + 3600 + expiryDurationInSeconds, // Set expiration
    fulfilled: fulfilled,
  };
}
export function getFunctionTriggerCalldata(executeContract: any, functionName: string, param1?: any, param2?: any, param3?: any) {
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
  const calldata = executeContract.interface.encodeFunctionData(functionName, args);

  return calldata;
}

export function flattenOrder(order: any) {
  const flattenOrder = [
    order.eid,
    order.buyer,
    order.seller,
    order.toSell.executeAddress,
    order.toSell.data,
    order.toFulfill.asset,
    order.toFulfill.ids,
    order.toFulfill.amountOrTokenIds,
    order.deadline,
    order.fulfilled,
  ];
  return flattenOrder;
}

export function getUniqueERC20Orders() {
  // 11 tokens
  const uni = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
  const bnb = "0xB8c77482e45F1F44dE1745F52C74426C631bDD52";
  const shib = "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE";
  const wton = "0x582d872A1B094FC48F5DE31D3B73F2D9bE47def1";
  const wbtc = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
  const link = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const leo = "0x2AF5D2aD76741191D15Dfe7bF6aC92d4Bd912Ca3";
  const usdc = TEST_CONFIG.TOKEN_ADDRESSES.USDC;
  const high = TEST_CONFIG.TOKEN_ADDRESSES.HIGH;
  const bayc = TEST_CONFIG.TOKEN_ADDRESSES.BAYC;
  const azuki = TEST_CONFIG.TOKEN_ADDRESSES.AZUKI;

  const offchainBasicOrders = [];
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const addresses = [uni, bnb, shib, wton, wbtc, link, leo, usdc, high, bayc, azuki];
  for (let i = 0; i < addresses.length; i++) {
    const toSell = { asset: addresses[i], ids: [0], amountOrTokenIds: [100] };
    const toFulfill = { asset: TEST_CONFIG.TOKEN_ADDRESSES.HIGH, ids: [0], amountOrTokenIds: [10] };
    const offchainBasicOrder = getBasicOrder(
      TEST_CONFIG.SIGNER_ADDRESSES.BUYER,
      TEST_CONFIG.SIGNER_ADDRESSES.SELLER,
      toSell,
      toFulfill,
      deadline,
      false
    );
    offchainBasicOrders.push(offchainBasicOrder);
  }
  return offchainBasicOrders;
}
