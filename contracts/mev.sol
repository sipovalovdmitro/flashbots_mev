// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IERC20.sol";
import "./libraries/SafeMath.sol";

contract MEV {
    using SafeMath for uint;

    address public wethAddr;
    address public owner;

    modifier onlyOwner() {
        require(owner == msg.sender, "MEV: access denied");
        _;
    }

    constructor(address _wethAddr) {
        wethAddr = _wethAddr;
        owner = msg.sender;
    }

    receive() external payable {}

    function depositWETH() external payable {
        IWETH(wethAddr).deposit{value: msg.value}();
    }

    function withdrawWETH(uint amount) external onlyOwner {
        IWETH(wethAddr).withdraw(amount);
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "MEV: Failed to withdraw wethAddr");
    }

    function withdrawETH() external onlyOwner {
        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        require(sent, "MEV: Failed to withdraw Ether");
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountOut) {
        assembly {
            if iszero(gt(amountIn, 0)) {
                revert(0, 0)
            }
            if or(iszero(gt(reserveIn, 0)), iszero(gt(reserveOut, 0))) {
                revert(0, 0)
            }
            let amountInWithFee := mul(amountIn, 997)
            let numerator := mul(amountInWithFee, reserveOut)
            let denominator := add(mul(reserveIn, 1000), amountInWithFee)
            amountOut := div(numerator, denominator)
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        uint deadline,
        address pair,
        address tokenToCapture,
        bool isWETHtoToken
    ) external onlyOwner {
        // require(deadline >= block.timestamp, "MEV: EXPIRED");
        // require(tokenToCapture != wethAddr, "MEV: IDENTICAL_ADDRESSES");
        // address input = isWETHtoToken ? wethAddr : tokenToCapture;
        // (bool success, bytes memory data) = input.call(
        //     abi.encodeWithSelector(0x23b872dd, address(this), pair, amountIn)
        // );
        // require(
        //     success && (data.length == 0 || abi.decode(data, (bool))),
        //     "MEV: transferFrom failed"
        // );
        // address token0 = wethAddr < tokenToCapture ? wethAddr : tokenToCapture;
        // (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pair).getReserves();
        // (uint reserveIn, uint reserveOut) = input == token0
        //     ? (reserve0, reserve1)
        //     : (reserve1, reserve0);
        // uint amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        // require(amountOut >= amountOutMin, "MEV: Insufficient amount out");
        // (uint amount0Out, uint amount1Out) = input == token0
        //     ? (uint(0), amountOut)
        //     : (amountOut, uint(0));
        uint amount0Out;
        uint amount1Out;
        assembly {
            // weth address
            let weth := sload(wethAddr.slot)

            // validate current block time
            if iszero(gt(deadline, timestamp())) {
                revert(0, 0)
            }

            // validate the tokenToCapture
            if eq(tokenToCapture, weth) {
                revert(0, 0)
            }

            // populate input token address
            let input := 0x00
            switch isWETHtoToken
            case true {
                input := weth
            }
            case false {
                input := tokenToCapture
            }

            // call transferFrom function in the input token contract
            // bytes4(keccak256("transferFrom(address,address,uint256)")) = 0x23b872dd;
            mstore(0x80, 0x23b872dd)
            mstore(0xa0, address())
            mstore(0xc0, pair)
            mstore(0xe0, amountIn)
            let success := call(gas(), input, 0, 0x9c, 0x64, 0x100, 0x20)
            mstore(0x40, 0x120)
            if iszero(success) {
                revert(0, 0)
            }

            // check the first token address
            let token0
            switch gt(tokenToCapture, weth)
            case true {
                token0 := weth
            }
            default {
                token0 := tokenToCapture
            }

            // check amount out is larger than amount out min
            // bytes4(keccak256("getReserves()")) = 0x0902f1ac;
            let freememptr := mload(0x40)
            mstore(freememptr, 0x0902f1ac)
            success := staticcall(
                gas(),
                pair,
                add(freememptr, 0x1c),
                4,
                add(freememptr, 0x20),
                0x40
            )
            if iszero(success) {
                revert(0, 0)
            }
            mstore(0x40, add(freememptr, 0x60))

            let reserveIn
            let reserveOut
            switch eq(input, token0)
            case true {
                reserveIn := mload(add(freememptr, 0x20))
                reserveOut := mload(add(freememptr, 0x40))
            }
            default {
                reserveIn := mload(add(freememptr, 0x40))
                reserveOut := mload(add(freememptr, 0x20))
            }

            function getAmountOut(amtIn, resIn, resOut) -> amtOut {
                if iszero(gt(amtIn, 0)) {
                    revert(0, 0)
                }
                if or(iszero(gt(resIn, 0)), iszero(gt(resOut, 0))) {
                    revert(0, 0)
                }
                let amountInWithFee := mul(amtIn, 997)
                let numerator := mul(amountInWithFee, resOut)
                let denominator := add(mul(resIn, 1000), amountInWithFee)
                amtOut := div(numerator, denominator)
            }

            let amountOut := getAmountOut(amountIn, reserveIn, reserveOut)

            if lt(amountOut, amountOutMin) {
                revert(0, 0)
            }

            // swap
            // let amount0Out
            // let amount1Out
            switch eq(input, token0)
            case true {
                amount0Out := 0
                amount1Out := amountOut
            }
            default {
                amount0Out := amountOut
                amount1Out := 0
            }

            // // bytes4(keccak256("swap(uint256,uint256,address,bytes)")) = 0x022c0d9f;
            // freememptr := mload(0x40)
            // mstore(freememptr, 0x022c0d9f)
            // mstore(add(freememptr, 0x20), amount0Out)
            // mstore(add(freememptr, 0x40), amount1Out)
            // mstore(add(freememptr, 0x60), address())
            // mstore(add(freememptr, 0x80), data)

            // success := call(
            //     gas(),
            //     pair,
            //     0,
            //     add(freememptr, 0x1c),
            //     0x84,
            //     add(freememptr, 0xa0),
            //     0x00
            // )
            // if iszero(success) {
            //     revert(0, 0)
            // }
        }
        IUniswapV2Pair(pair).swap(
            amount0Out,
            amount1Out,
            address(this),
            new bytes(0)
        );
    }
}
