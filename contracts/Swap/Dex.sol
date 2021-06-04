//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

import "hardhat/console.sol";

contract Dex{

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    IUniswapV2Router02 internal uniswapRouter = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    function makeSwap(address to, uint amount) payable public {
        require(msg.value > 0, "Not enough ETH");
        
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = to;

        uniswapRouter.swapExactETHForTokens{value: msg.value}(amount, path, msg.sender, block.timestamp + 3600);
    }

}