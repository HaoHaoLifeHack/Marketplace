import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ethers, network } from "hardhat";

export function generateMerkleTree(orders: any[]) {
  const leaves = orders.map((order) => [
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
  ]);
  const merkleTree = StandardMerkleTree.of(leaves, getLeafEncoding());
  return merkleTree;
}

export async function searchProof(tree: StandardMerkleTree<any>, target: any) {
  var proof;
  for (const [i, v] of tree.entries()) {
    const leafHash = ethers.solidityPackedKeccak256(getLeafEncoding(), v);
    console.log(`leaf hash${i}: ${leafHash}`);
    const targetHash = ethers.solidityPackedKeccak256(getLeafEncoding(), target);
    console.log(`target hash: ${targetHash}`);
    if (leafHash === targetHash) {
      console.log(`found proof: ${i}`);
      proof = tree.getProof(i);
      break;
    }
  }
  return proof;
}

function getLeafEncoding() {
  return ["uint256", "address", "address", "address", "bytes", "address", "uint256[]", "uint256[]", "uint256", "bool"];
}
