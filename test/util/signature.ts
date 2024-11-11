import { ethers } from "hardhat";
import "../../typechain-types";
import { BytesLike } from "@openzeppelin/merkle-tree/dist/bytes";
import { defaultAbiCoder } from "@ethersproject/abi";
import { keccak256 } from "@ethersproject/keccak256";
import { TEST_CONFIG } from "./testConfig";

export interface OrderStruct {
  eid: bigint;
  buyer: string;
  seller: string;
  toSell: { executeAddress: string; data: string };
  toFulfill: { asset: string; ids: number[]; amountOrTokenIds: number[] };
  fulfilled: boolean;
  deadline: bigint;
}

export async function getOrderSignature(orderData: any, signerAddress: string): Promise<string> {
  const signer = await ethers.getSigner(signerAddress);
  const messageHash = getOrderHash(orderData);
  return await signer.signMessage(ethers.toBeArray(messageHash));
}

export async function verifyOrderSignature(orderData: any, signature: string): Promise<boolean> {
  const messageHash = getOrderHash(orderData);
  const messageBytes = ethers.toBeArray(messageHash);
  const recoveredAddress = await ethers.verifyMessage(messageBytes, signature);
  return recoveredAddress === orderData.seller;
}

export function getOrderHash(orderData: OrderStruct): string {
  return keccak256(
    keccak256(
      defaultAbiCoder.encode(
        ["uint256", "address", "address", "address", "bytes", "address", "uint256[]", "uint256[]", "uint256", "bool"],
        [
          orderData.eid,
          orderData.buyer,
          orderData.seller,
          orderData.toSell.executeAddress,
          orderData.toSell.data,
          orderData.toFulfill.asset,
          orderData.toFulfill.ids,
          orderData.toFulfill.amountOrTokenIds,
          orderData.deadline,
          orderData.fulfilled,
        ]
      )
    )
  );
}
