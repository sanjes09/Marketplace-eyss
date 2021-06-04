//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';

contract NFT1155 is ERC1155{

    uint private id = 1;

    constructor() ERC1155(""){}
    
    function mint(uint amount) public{
        _mint(msg.sender, id, amount, "");
        id++;
    }

}