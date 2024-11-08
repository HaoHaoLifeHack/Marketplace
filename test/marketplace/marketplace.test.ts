describe("Withdraw", function () {
  it("Should allow the owner to withdraw platform fees", async function () {
    const marketplaceAddress = await marketplace.getAddress();
    const contractBalanceBefore = await ethers.provider.getBalance(marketplaceAddress);
    console.log(`Contract balance before withdrawal: ${contractBalanceBefore}`);
    // Check that the owner's balance increased (considering gas fees)
    const ownerBalanceBefore = await ethers.provider.getBalance(ownerWallet.address);

    console.log(`Owner balance before withdrawal: ${ownerBalanceBefore}`);

    // Withdraw funds by the owner
    await marketplace.withdraw();

    // Check that the contract's balance is now 0 after withdrawal
    const contractBalanceAfterWithdraw = await ethers.provider.getBalance(marketplaceAddress);
    console.log(`Contract balance after withdrawal: ${contractBalanceAfterWithdraw}`);
    expect(contractBalanceAfterWithdraw).to.equal(0);

    const ownerBalanceAfter = await ethers.provider.getBalance(ownerWallet.address);
    console.log(`Owner balance after withdrawal: ${ownerBalanceAfter}`);

    // Ensure the owner's balance increased correctly by the platform fee amount minus gas
    expect(ownerBalanceAfter).to.be.above(ownerBalanceBefore);
  });

  it("Should not allow non-owners to withdraw", async function () {
    // Simulate sending some ETH as platform fees to the contract
    const platformFeeAmount = ethers.parseEther("0.5");
    const marketplaceAddress = await marketplace.getAddress();
    await buyer.sendTransaction({
      to: marketplaceAddress,
      value: platformFeeAmount,
    });

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
  it("Should revert when priceFeed is the zero address in setChainlinkPriceFeed", async function () {
    const asset = ethers.ZeroAddress;
    await expect(oracleHandler.setChainlinkPriceFeed(asset, ethers.ZeroAddress)).to.be.revertedWith("Invalid price feed address");
  });

  it("Should revert when priceFeedAddress is not set in getLatestPriceInETH", async function () {
    const asset = ethers.ZeroAddress;
    await expect(oracleHandler.getLatestPriceInETH(asset)).to.be.revertedWith("Invalid price feed address");
  });
});
