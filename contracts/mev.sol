// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "node_modules/@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./interfaces/IWETH.sol";

contract MEV {
    address public immutable WETH;
    address public owner;

    modifier onlyOwner() {
        require(owner == msg.sender, "MEV: access denied");
        _;
    }

    constructor(address _WETH) {
        WETH = _WETH;
        owner = msg.sender;
    }

    receive() external payable {}

    function depositWETH() external payable {
        IWETH(WETH).deposit{value: msg.value}();
    }

    function swapExactTokensForTokens(
        // uint amountIn,
        uint amountOut,
        address pair,
        uint deadline,
        address[] calldata path
    ) external onlyOwner {
        require(deadline >= block.timestamp, "MEV: EXPIRED");
        (address input, address output) = (path[0], path[1]);
        require(input != output, "MEV: IDENTICAL_ADDRESSES");
        (address token0, ) = input < output ? (input, output) : (output, input);
        (uint amount0Out, uint amount1Out) = input == token0
            ? (uint(0), amountOut)
            : (amountOut, uint(0));

        IUniswapV2Pair(pair).swap(
            amount0Out,
            amount1Out,
            address(this),
            new bytes(0)
        );
    }
}
