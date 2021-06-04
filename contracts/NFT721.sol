//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract NFT721 is ERC721{

    constructor() ERC721("NFT721", "NFT"){}

    function mint(uint id) public{
        require(!_exists(id), "Item already exists");
        _safeMint(msg.sender, id);
    }

}