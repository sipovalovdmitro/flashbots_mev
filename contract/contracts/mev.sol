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

    constructor(address weth_, address owner_) {
        wethAddr = weth_;
        owner = owner_;
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

            // swap
            let amount0Out
            let amount1Out
            switch eq(input, token0)
            case true {
                amount0Out := 0
                amount1Out := amountOutMin
            }
            default {
                amount0Out := amountOutMin
                amount1Out := 0
            }

            // // bytes4(keccak256("swap(uint256,uint256,address,bytes)")) = 0x022c0d9f;
            let freememptr := mload(0x40)
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
