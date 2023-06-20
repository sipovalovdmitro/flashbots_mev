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

    function v2WethOutput0(uint amountIn, uint amountOut, address pair, address tokenIn) public onlyOwner{
    }
    
    function v2WethInput0(uint amountIn, uint amountOut, address pair) public onlyOwner{

    }
    function v2WethOutput1(uint amountIn, uint amountOut, address pair, address tokenIn) public onlyOwner{

    }
    function v2WethInput1(uint amountIn, uint amountOut, address pair) public onlyOwner{

    }
}
