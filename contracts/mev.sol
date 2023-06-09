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
        assembly {
            let owneraddr := sload(owner.slot)
            if iszero(eq(owneraddr, caller())) {
                revert(0, 0)
            }
        }
        _;
    }

    constructor() {
        wethAddr = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        owner = msg.sender;
    }

    receive() external payable {}

    function depositWETH() external payable {
        IWETH(wethAddr).deposit{value: msg.value}();
    }

    function withdrawWETH(uint amount) external onlyOwner {
        assembly {
            let weth := sload(wethAddr.slot)
            let ptr := mload(0x40)
            mstore(ptr, 0x2e1a7d4d)
            mstore(add(ptr, 0x20), amount)
            mstore(0x40, add(ptr, 0x40))
            let success := call(gas(), weth, 0, add(ptr, 0x1c), 0x24, 0, 0)
            if iszero(success) {
                revert(0, 0)
            }
            success := call(gas(), caller(), amount, 0, 0, 0, 0)
            if iszero(success) {
                revert(0, 0)
            }
        }
        // IWETH(wethAddr).withdraw(amount);
        // (bool sent, ) = msg.sender.call{value: amount}("");
        // require(sent, "MEV: Failed to withdraw WETH");
    }

    function withdrawETH() external onlyOwner {
        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        require(sent, "MEV: Failed to withdraw Ether");
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address pair,
        address tokenToCapture,
        bool isWETHtoToken,
        uint deadline
    ) external onlyOwner {
        // require(deadline >= block.timestamp, "MEV: EXPIRED");
        // require(tokenToCapture != wethAddr, "MEV: IDENTICAL_ADDRESSES");
        // address input = isWETHtoToken ? wethAddr : tokenToCapture;
        // // IERC20(input).transfer(pair, amountIn);
        // (bool success, bytes memory data) = input.call(
        //     abi.encodeWithSelector(0xa9059cbb, pair, amountIn)
        // );
        // require(
        //     success && (data.length == 0 || abi.decode(data, (bool))),
        //     "MEV: transfer failed"
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
        // IUniswapV2Pair(pair).swap(
        //     amount0Out,
        //     amount1Out,
        //     address(this),
        //     new bytes(0)
        // );
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
            let input
            switch isWETHtoToken
            case true {
                input := weth
            }
            default {
                input := tokenToCapture
            }

            // call transferFrom function in the input token contract
            // bytes4(keccak256("transfer(address,uint256)")) = 0xa9059cbb;
            mstore(0x80, 0xa9059cbb)
            mstore(0xa0, pair)
            mstore(0xc0, amountIn)
            let success := call(gas(), input, 0, 0x9c, 0x44, 0xe0, 0x20)
            mstore(0x40, 0x100)
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
            freememptr := mload(0x40)
            mstore(freememptr, input)
            mstore(add(freememptr, 0x20), token0)

            if lt(amountOut, amountOutMin) {
                revert(0, 0)
            }
            log1(freememptr, 0x40, 1)

            // swap
            let amount0Out
            let amount1Out
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
            freememptr := mload(0x40)
            mstore(freememptr, 0x022c0d9f)
            mstore(add(freememptr, 0x20), amount0Out)
            mstore(add(freememptr, 0x40), amount1Out)
            mstore(add(freememptr, 0x60), address())
            mstore(
                add(freememptr, 0x80),
                0x80
            ) /* position of where length of "bytes data" is stored from first arg (excluding func signature) */
            mstore(add(freememptr, 0xa0), 0x0)

            success := call(
                gas(),
                pair,
                0,
                add(freememptr, 0x1c),
                0xa4,
                0x0,
                0x0
            )
            if iszero(success) {
                revert(0, 0)
            }
        }
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
}
