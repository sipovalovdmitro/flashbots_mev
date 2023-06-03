// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "node_modules/@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "node_modules/@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IWETH.sol";
import "./libraries/SafeMath.sol";

contract MEV {
    using SafeMath for uint;

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

    function withdrawWETH(uint amount) external onlyOwner {
        IWETH(WETH).withdraw(amount);
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "MEV: Failed to withdraw WETH");
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    function withdrawETH() external onlyOwner {
        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        require(sent, "MEV: Failed to withdraw Ether");
    }

    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountOut) {
        require(amountIn > 0, "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
        );
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address pair,
        uint deadline,
        address tokenToCapture,
        bool isWETHtoToken
    ) external onlyOwner {
        require(deadline >= block.timestamp, "MEV: EXPIRED");
        require(tokenToCapture != WETH, "MEV: IDENTICAL_ADDRESSES");
        (address input, address output) = isWETHtoToken? (WETH, tokenToCapture): (tokenToCapture, WETH);
        (address token0, ) = input < output ? (input, output) : (output, input);
        (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pair).getReserves();
        (uint reserveIn, uint reserveOut) = input == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
        uint amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "MEV: Insufficient amount out");
        (uint amount0Out, uint amount1Out) = input == token0
            ? (uint(0), amountOut)
            : (amountOut, uint(0));
        TransferHelper.safeTransferFrom(input, address(this), pair, amountIn);

        IUniswapV2Pair(pair).swap(
            amount0Out,
            amount1Out,
            address(this),
            new bytes(0)
        );
    }
}
