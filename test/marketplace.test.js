const {BN, expectEvent, time, expectRevert} = require('@openzeppelin/test-helpers');
const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
require("chai").use(require("chai-bn")(BN));

const toWei = (value) => web3.utils.toWei(String(value));

const Roter02 = artifacts.require("IUniswapV2Router02");
const IERC20 = artifacts.require("IERC20");
const Uniswap = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

describe("Markeplace", () => {
  let admin;
  let alice;
  let bob;
  let recipient;

  let nft1155_1;
  let nft1155_2;
  let marketplace;
  let uniswap;
  let dex;
  let dai;
  let link;

  before(async () => {
    [admin, alice, bob, recipient] = await ethers.getSigners();
    const MarketplaceV1 = await ethers.getContractFactory("MarketplaceV1");
    marketplace = await upgrades.deployProxy(MarketplaceV1, [recipient.address, 1]);
    await marketplace.deployed();

    const NFT1155 = await ethers.getContractFactory("NFT1155");
    nft1155_1 = await NFT1155.deploy();
    await nft1155_1.deployed();
    nft1155_2 = await NFT1155.deploy();
    await nft1155_2.deployed();
    

    const Dex = await ethers.getContractFactory("Dex");
    dex = await Dex.deploy();
    await dex.deployed();
    uniswap = await Roter02.at(Uniswap);

    dai = await IERC20.at(DAI);
    link = await IERC20.at(LINK);
  });

  it("Should get DAI and LINK balance", async () => {
    let x = await uniswap.getAmountsOut(toWei("0.99"), [WETH,DAI]);
    amountToBuy = String(x[1]);

    let x2 = await uniswap.getAmountsOut(toWei("0.99"), [WETH,LINK]);
    amountToBuy2 = String(x2[1]);

    let prevBalanceDAI = await dai.balanceOf(alice.address);
    await dex.connect(alice).makeSwap(DAI, amountToBuy, {value: toWei("1")});
    await dex.connect(bob).makeSwap(DAI, amountToBuy, {value: toWei("1")});
    let postBalanceDAI = await dai.balanceOf(alice.address);

    assert(Number(prevBalanceDAI) < Number(postBalanceDAI));

    let prevBalanceLINK = await link.balanceOf(alice.address);
    await dex.connect(alice).makeSwap(LINK, amountToBuy2, {value: toWei("1")});
    await dex.connect(bob).makeSwap(LINK, amountToBuy2, {value: toWei("1")});
    let postBalanceLINK = await link.balanceOf(alice.address);

    assert(Number(prevBalanceLINK) < Number(postBalanceLINK));
  })

  it("Should have created NFT", async () => {
    await nft1155_1.connect(alice).mint(100);
    await nft1155_2.connect(bob).mint(100);

    let amountAlice = await nft1155_1.balanceOf(alice.address, 1);
    let amountBob = await nft1155_2.balanceOf(bob.address, 1);
    
    expect(Number(amountAlice)).to.gt(0);
    expect(Number(amountBob)).to.gt(0);
  })

  it("Should fail to create sell order (not apporved)", async () => {
    await expectRevert(
      marketplace.connect(alice).sell(nft1155_1.address, 1, 10, Number(time.duration.days(10)), 100),
      'Not approved'
    );
  })

  it("Should create a sell order", async () => {
    await nft1155_1.connect(alice).setApprovalForAll(marketplace.address,true);
    await marketplace.connect(alice).sell(nft1155_1.address, 1, 10, Number(time.duration.days(10)), 100);
    let order = await marketplace.orders(1);
    expect(order.seller).to.equal(alice.address);
    expect(order.token).to.equal(nft1155_1.address);
    expect(Number(order.tokenId)).to.equal(1);
    expect(Number(order.amount)).to.equal(10);
    expect(Number(order.price)).to.equal(100);

    // let tx = await marketplace.connect(alice).sell(nft1155_1.address, 1, 10, Number(time.duration.days(10)), 100);
    // expectEvent(tx, "Sell", {
    //   seller: alice.address,
    //   orderId: ethers.BigNumber.from(1)
    // });
  })

  it("Should buy an order with ETH", async () => {
    let prevBalance = await nft1155_1.balanceOf(bob.address, 1);
    let prevEth = await alice.getBalance();
    let prevEthRec = await recipient.getBalance();
    await marketplace.connect(bob).buyWithEth(1,{value: toWei("1")});
    let postBalance = await nft1155_1.balanceOf(bob.address, 1);
    let postEth = await alice.getBalance();
    let postEthRec = await recipient.getBalance();
    expect(Number(postBalance)).to.gt(Number(prevBalance));
    expect(Number(postEth)).to.gt(Number(prevEth));
    expect(Number(postEthRec)).to.gt(Number(prevEthRec));
  })

  it("Should not buy an order not active", async () => {
    await expectRevert(
      marketplace.connect(bob).buyWithEth(1,{value: toWei("1")}),
      'Order not active'
    );
  })

  it("Should create a sell order for DAI", async () => {
    await nft1155_2.connect(bob).setApprovalForAll(marketplace.address,true);
    await marketplace.connect(bob).sell(nft1155_2.address, 1, 10, Number(time.duration.days(10)), 100);
    let order = await marketplace.orders(2);
    expect(order.seller).to.equal(bob.address);
    expect(order.token).to.equal(nft1155_2.address);
    expect(Number(order.tokenId)).to.equal(1);
    expect(Number(order.amount)).to.equal(10);
    expect(Number(order.price)).to.equal(100);

    // let tx = await marketplace.connect(alice).sell(nft1155_2.address, 1, 10, Number(time.duration.days(10)), 100);
    // expectEvent(tx, "Sell", {
    //   seller: alice.address,
    //   orderId: ethers.BigNumber.from(1)
    // });
  })

  it("Should not buy an order with DAI if not approved", async () => {
    await expectRevert(
      marketplace.connect(alice).buyWithERC20(2,1),
      'Dai/insufficient-allowance'
    );
  })

  it("Should buy an order with DAI", async () => {
    let balanceToApprove = await dai.balanceOf(alice.address);
    await dai.approve(marketplace.address, String(balanceToApprove), {from: alice.address});
    let prevBalance = await nft1155_2.balanceOf(alice.address, 1);
    let prevDAI = await dai.balanceOf(bob.address);
    await marketplace.connect(alice).buyWithERC20(2,1);
    let postBalance = await nft1155_2.balanceOf(alice.address, 1);
    let postDAI = await dai.balanceOf(bob.address);
    expect(Number(postBalance)).to.gt(Number(prevBalance));
    expect(Number(postDAI)).to.gt(Number(prevDAI));
  })

  it("Should create a sell order for LINK", async () => {
    await marketplace.connect(bob).sell(nft1155_2.address, 1, 10, Number(time.duration.days(10)), 100);
    let order = await marketplace.orders(3);
    expect(order.seller).to.equal(bob.address);
    expect(order.token).to.equal(nft1155_2.address);
    expect(Number(order.tokenId)).to.equal(1);
    expect(Number(order.amount)).to.equal(10);
    expect(Number(order.price)).to.equal(100);

    // let tx = await marketplace.connect(alice).sell(nft1155_2.address, 1, 10, Number(time.duration.days(10)), 100);
    // expectEvent(tx, "Sell", {
    //   seller: alice.address,
    //   orderId: ethers.BigNumber.from(1)
    // });
  })

  it("Should not buy an order with LINK if not approved", async () => {
    await expectRevert(
      marketplace.connect(alice).buyWithERC20(3,2),
      'SafeERC20: low-level call failed'
    );
  })

  it("Should buy an order with LINK", async () => {
    let balanceToApprove = await link.balanceOf(alice.address);
    await link.approve(marketplace.address, String(balanceToApprove), {from: alice.address});
    let prevBalance = await nft1155_2.balanceOf(alice.address, 1);
    let prevLINK = await link.balanceOf(bob.address);
    await marketplace.connect(alice).buyWithERC20(3,2);
    let postBalance = await nft1155_2.balanceOf(alice.address, 1);
    let postLINK = await link.balanceOf(bob.address);
    expect(Number(postBalance)).to.gt(Number(prevBalance));
    expect(Number(postLINK)).to.gt(Number(prevLINK));
  })

  it("Should create a sell order", async () => {
    await marketplace.connect(bob).sell(nft1155_2.address, 1, 10, Number(time.duration.days(10)), 100);
    let order = await marketplace.orders(4);
    expect(order.seller).to.equal(bob.address);
    expect(order.token).to.equal(nft1155_2.address);
    expect(Number(order.tokenId)).to.equal(1);
    expect(Number(order.amount)).to.equal(10);
    expect(Number(order.price)).to.equal(100);

    // let tx = await marketplace.connect(alice).sell(nft1155_2.address, 1, 10, Number(time.duration.days(10)), 100);
    // expectEvent(tx, "Sell", {
    //   seller: alice.address,
    //   orderId: ethers.BigNumber.from(1)
    // });
  })

  it("Should cancel and order", async () => {
    let orderPrev = await marketplace.orders(4);
    await marketplace.connect(bob).cancelOrder(4);
    let orderPost = await marketplace.orders(4);
    expect(orderPrev.active).to.not.equal(orderPost.active);
  })

  it("Should not buy an order with LINK if not approved", async () => {
    await expectRevert(
      marketplace.connect(alice).buyWithERC20(4,2),
      'Order not active'
    );
  })

});