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

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address pair,
        address tokenToCapture,
        bool isWETHtoToken,
        uint deadline
    ) external onlyOwner {
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
            default {
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
}
