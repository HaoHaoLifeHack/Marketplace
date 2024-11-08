describe("Sweep order", function () {
  it("Should fulfill multiple orders with sweepOrders", async function () {
    const orders = setupSweepOrders();

    // Mock seller's signatures (assume we have a recoverSigner function)
    let orderHashes = [];
    let signatures = [];

    for (let i = 0; i < orders.length; i++) {
      const orderHash = await marketplace.getOrderHashBasic(orders[i]);
      const signature = await signOrder(sellerWallet, orderHash);
      orderHashes.push(orderHash);
      signatures.push(signature);
    }

    // Set up price and fees in Oracle mock
    const PLATFORM_FEE_BPS = 5;
    const FACTOR = 100;
    const priceInETH = Number(ethers.parseEther("0.01")); // 0.01 ETH price for TKB
    const totalPlatformFee = ((priceInETH * (PLATFORM_FEE_BPS * FACTOR)) / (100 * FACTOR)) * orders.length;

    // Execute sweepOrders and verify balances
    await expect(marketplace.connect(buyer).sweepOrders(orders, signatures, { value: totalPlatformFee }))
      .to.emit(marketplace, "OrderFulfilled")
      .withArgs(orderHashes[0], buyer.address, 0)
      .and.emit(marketplace, "OrderFulfilled")
      .withArgs(orderHashes[1], buyer.address, 0)
      .and.emit(marketplace, "OrderFulfilled")
      .withArgs(orderHashes[2], buyer.address, 0)
      .and.emit(marketplace, "OrderFulfilled")
      .withArgs(orderHashes[3], buyer.address, 0);

    console.log("buyer HIGH balance: ", await high.balanceOf(buyer.address));
    console.log("buyer USDC balance: ", await usdc.balanceOf(buyer.address));

    console.log("seller HIGH balance after sweeping orders: ", await high.balanceOf(seller.address));
    console.log("seller USDC balance after sweeping orders: ", await usdc.balanceOf(seller.address));
    // Check buyer's token balance
    const buyerUSDCBalance = await usdc.balanceOf(buyer.address);
    const buyerBAYCBalance = await bayc.balanceOf(buyer.address);
    const buyerGOLDBalance = await gameItems.balanceOf(buyer.address, 1);
    const buyerSILVERBalance = await gameItems.balanceOf(buyer.address, 2);
    const buyerTHORSHAMMERBalance = await gameItems.balanceOf(buyer.address, 3);
    expect(buyerUSDCBalance).to.equal(300);
    expect(buyerBAYCBalance).to.equal(1);
    expect(buyerGOLDBalance).to.equal(100);
    expect(buyerSILVERBalance).to.equal(100);
    expect(buyerTHORSHAMMERBalance).to.equal(1);
    console.log(
      `buyer USDC balance: ${buyerUSDCBalance}, buyer BAYC balance: ${buyerBAYCBalance}, buyer GOLD balance: ${buyerGOLDBalance}, buyer SILVER balance: ${buyerSILVERBalance}, buyer THORSHAMMER balance: ${buyerTHORSHAMMERBalance}`
    );
    // Check seller's token balance
    const sellerHIGHBalance = await high.balanceOf(seller.address);
    expect(sellerHIGHBalance).to.equal(50);
  });
});
