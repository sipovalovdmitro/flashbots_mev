object "MEV" {
    code {
        mstore(0x40, 0x80)
        let ptr := mload(0x40)
        sstore(0, 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2)
        sstore(1, caller())
        datacopy(ptr, dataoffset("runtime"), datasize("runtime"))
        return(ptr, datasize("runtime"))
    }
    object "runtime" {
        // Storage layout:
        // slot 0 : weth address
        // slot 1 : owner of this contract
        code {
            switch getselector()
            case 0x7d5aa5f4 {
                // function wethAddr()
                mstore(0x40, 0x80)
                let ptr := mload(0x40)
                mstore(ptr, sload(0))
                mstore(0x40, add(ptr, 0x20))
                return(ptr, 0x20)
            }
            case 0x8da5cb5b {
                // function owner()
                mstore(0x40, 0x80)
                let ptr := mload(0x40)
                mstore(ptr, sload(1))
                mstore(0x40, add(ptr, 0x20))
                return(ptr, 0x20)
            }
            case 0x1de3df2c {
                // function depositWETH() external payable
                mstore(0x40, 0x80)
                if eq(callvalue(),0) {
                    revert(0, 0)
                }
                let weth := sload(0)
                // deposit() selector 
                let ptr := mload(0x40)
                mstore(ptr, 0xd0e30db0)
                mstore(0x40, add(ptr, 0x20))
                let success := call(gas(), weth, callvalue(), add(ptr, 0x1c), 4, 0, 0)
                if iszero(success) {
                    revert(0, 0)
                }
            }
            case 0xfc4dd333 {
                // function withdrawWETH(uint amount)
                mstore(0x40, 0x80)
                if gt(callvalue(), 0) {
                    revert(0, 0)
                }
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                let weth := sload(0)
                let ptr := mload(0x40)
                let amount := calldataload(4)
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
            case 0xe086e5ec {
                // function withdrawETH()
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                let success := call(gas(), caller(), selfbalance(), 0, 0, 0, 0)
                if iszero(success) {
                    revert(0, 0)
                }
            }
            case 0xf2fde38b {
                // function transferOwnership(address _newOwner)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                sstore(1, calldataload(4))
            }
            case 0xe63ede0b {
                mstore(0x40, 0x80)
                // swapExactTokensForTokens(uint256,uint256,address,address,bool,uint256)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                // weth address
                let weth := sload(0)
                let deadline := calldataload(0xa4)
                // validate current block time
                if iszero(gt(deadline, timestamp())) {
                    revert(0, 0)
                }

                // validate the tokenToCapture
                let tokenToCapture := calldataload(0x64)
                if eq(tokenToCapture, weth) {
                    revert(0, 0)
                }

                // populate input token address
                let input
                let isWETHtoToken := calldataload(0x84)

                switch isWETHtoToken
                case true {
                    input := weth
                }
                default {
                    input := tokenToCapture
                }

                // call transfer function from the input token contract
                // bytes4(keccak256("transfer(address,uint256)")) = 0xa9059cbb;
                let freememptr := mload(0x40)
                let amountIn := calldataload(4)
                let pair := calldataload(0x44)
                mstore(freememptr, 0xa9059cbb)
                mstore(add(freememptr, 0x20), pair)
                mstore(add(freememptr, 0x40), amountIn)
                let success := call(gas(), input, 0, add(freememptr, 0x1c), 0x44, add(freememptr, 0x60), 0x20)
                let result := mload(add(freememptr, 0x60))
                if or(iszero(success), iszero(result)) {
                    revert(0, 0)
                }
                mstore(0x40, add(freememptr, 0x80))
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
                freememptr := mload(0x40)
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
                mstore(0x40, add(freememptr, 0x60))
                
                let amountOut := getAmountOut(amountIn, reserveIn, reserveOut)
                let amountOutMin := calldataload(0x24)
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

                // bytes4(keccak256("swap(uint256,uint256,address,bytes)")) = 0x022c0d9f;
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
                mstore(0x40, add(freememptr, 0xc0))                
                if iszero(success) {
                    revert(0, 0)
                }
            }
            default{
                if eq(callvalue(), 0) {
                    revert(0, 0)
                }
            }
            /* ==========================*/
            /* =========Helpers==========*/
            /* ==========================*/
            function getselector() -> selector {
                selector := shr(0xe0, calldataload(0))
            }
            function calledbyowner() -> cbo {
                let owner := sload(1)
                cbo := eq(owner, caller())
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
        }

        

    }
}