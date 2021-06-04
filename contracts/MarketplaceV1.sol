//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

contract MarketplaceV1 is Initializable, OwnableUpgradeable{

  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //EVENTS
  event Sell(address seller, uint256 orderId);
  event Buy(address buyer, uint256 orderId);
  event Cancel(address seller, uint256 orderId);

  AggregatorV3Interface internal priceFeedUSD;
  AggregatorV3Interface internal priceFeedDAI;
  AggregatorV3Interface internal priceFeedLINK;
  IERC20 DAI;
  IERC20 LINK;

  address public recipient;
  uint256 public fee;
  struct Order{
    address seller;
    address token;
    uint256 tokenId;
    uint256 amount;
    uint256 deadline;
    uint256 price;
    bool active;
  }
  mapping(uint256 => Order) public orders;
  uint256 public orderId;

  function initialize(address _recipient, uint256 _fee) public initializer{
    __Ownable_init();

    recipient = _recipient;
    fee = _fee;

    priceFeedUSD = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419); 
    priceFeedDAI = AggregatorV3Interface(0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9); 
    priceFeedLINK = AggregatorV3Interface(0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c); 
    DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    LINK = IERC20(0x514910771AF9Ca656af840dff83E8264EcF986CA);
    orderId = 1;
  }

  /**
    @notice Get current WEI price per USD value in ETH
  */
  function getLatestPriceUSD() public view returns (uint) {
    (
      /* uint80 roundId */,
      int256 answer,
      /* uint256 startedAt */,
      /* uint256 updatedAt */,
      /* uint80 answeredInRound */
    ) = priceFeedUSD.latestRoundData();
    // return answer;
    int weiUsd = 10**26/answer;
    return uint(weiUsd);
  }

  /**
    @notice Get current WEI price per USD value in DAI
  */
  function getLatestPriceDAI() public view returns (uint) {
    (
      /* uint80 roundId */,
      int256 answer,
      /* uint256 startedAt */,
      /* uint256 updatedAt */,
      /* uint80 answeredInRound */
    ) = priceFeedDAI.latestRoundData();
    // return answer;
    int weiUsd = 10**26/answer;
    return uint(weiUsd);
  }

  /**
    @notice Get current WEI price per USD value in LINK
  */
  function getLatestPriceLINK() public view returns (uint) {
    (
      /* uint80 roundId */,
      int256 answer,
      /* uint256 startedAt */,
      /* uint256 updatedAt */,
      /* uint80 answeredInRound */
    ) = priceFeedLINK.latestRoundData();
    // return answer;
    int weiUsd = 10**26/answer;
    return uint(weiUsd);
  }

  /**
    @notice updates the recipient address and fee %
    @param _recipient new address to set
    @param _fee new free to set
  */
  function updateData(address _recipient, uint256 _fee) public onlyOwner{
    recipient = _recipient;
    fee = _fee;
  }

  /**
    @notice creates a sell order
    @param token token contract address
    @param tokenId token id
    @param amount amounts of tokens to sell
    @param deadline order time available
    @param price order price
  */
  function sell(address token, uint256 tokenId, uint256 amount, uint256 deadline, uint256 price) public {
    require(amount > 0, "Can't sell 0 tokens");
    require(deadline > 0, "Introduce deadline");
    require(IERC1155(token).balanceOf(msg.sender, tokenId) >= amount, "Not enough items owned");
    require(IERC1155(token).isApprovedForAll(msg.sender, address(this)), "Not approved");

    Order memory newOrder = Order({
      seller: msg.sender,
      token: token,
      tokenId: tokenId,
      amount: amount,
      deadline: block.timestamp + deadline,
      price: price,
      active: true
    });
    orders[orderId] = newOrder;
    emit Sell(msg.sender, orderId);
    orderId++;
  }

  /**
    @notice cancels order
    @param _orderId orderId to cancel
  */
  function cancelOrder(uint256 _orderId) public {
    Order storage order = orders[_orderId];
    require(order.seller == msg.sender, "Order is not yours");
    order.active = false;
    emit Cancel(msg.sender, _orderId);
  }

  /**
    @notice buy an order with ETH
    @param _orderId orderId to buy
  */
  function buyWithEth(uint256 _orderId) public payable {
    require(msg.value > 0, "You must pay!");

    Order storage order = orders[_orderId];

    require(order.active, "Order not active");
    require(order.deadline > block.timestamp, "Order ended");
    require(order.seller != msg.sender, "Its your own item");

    uint weiPerUsd = getLatestPriceUSD();

    require(msg.value >= order.price * weiPerUsd);
    uint resto = msg.value - (order.price * weiPerUsd);
    uint comision = (order.price * weiPerUsd).mul(fee).div(100);
    uint payAmount = (order.price * weiPerUsd).sub(comision);
    order.active = false;

    payable(msg.sender).transfer(resto);
    payable(order.seller).transfer(payAmount);
    payable(recipient).transfer(comision);

    // execute ERC1155 transfer
    IERC1155(order.token).safeTransferFrom(order.seller, msg.sender, order.tokenId, order.amount, "");

    emit Buy(msg.sender, _orderId);

    // new event
  }

  /**
    @notice buy an order with ERC20
    @param _orderId orderId to buy
  */
  function buyWithERC20(uint _orderId, uint option) public {
    Order storage order = orders[_orderId];
    require(order.active, "Order not active");
    require(order.deadline > block.timestamp, "Order ended");
    require(order.seller != msg.sender, "Its your own item");

    uint weiPerUsd = 0;
    if(option == 1){
      weiPerUsd = getLatestPriceDAI();
    }
    if(option == 2){
      weiPerUsd = getLatestPriceLINK();
    }

    uint comision = (order.price * weiPerUsd).mul(fee).div(100);
    uint payAmount = (order.price * weiPerUsd).sub(comision);

    order.active = false;

    if(option == 1){
      DAI.safeTransferFrom(msg.sender, order.seller, payAmount);
      DAI.safeTransferFrom(msg.sender, recipient, comision);
    }
    if(option == 2){
      LINK.safeTransferFrom(msg.sender, order.seller, payAmount);
      LINK.safeTransferFrom(msg.sender, recipient, comision);
    }

    // execute ERC1155 transfer
    IERC1155(order.token).safeTransferFrom(order.seller, msg.sender, order.tokenId, order.amount, "");

    emit Buy(msg.sender, _orderId);
  }

}