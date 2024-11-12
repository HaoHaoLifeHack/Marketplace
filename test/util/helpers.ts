import { ethers } from "hardhat";

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
