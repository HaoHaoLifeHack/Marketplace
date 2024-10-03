# Marketplace

The **Marketplace** contract is a platform that enables users to list, trade, and fulfill orders for assets such as ERC20 tokens and ERC721 NFTs. Key features include:

1. **Listing Orders**: Sellers can list their order with specific terms, including toSell asset(ERC20 or ERC721), toFulfill (ERC20 or ERC721) details.
2. **Order Fulfillment**: Buyers can fulfill orders by sending the amount of required toFulfill, and the assets are transferred automatically upon completion.
3. **Platform Fee**: A 5% platform fee is charged on each transaction, with fees collected in Ether.
4. **Order Cancellation**: Sellers can cancel their orders before they are fulfilled.
5. **Asset Handling**: The contract supports both ERC20 and ERC721 tokens, ensuring proper transfer logic based on the asset type.
6. **Withdraw fee in Marketplace: The** owner can withdraw transaction fee from Marketplace contract.

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
