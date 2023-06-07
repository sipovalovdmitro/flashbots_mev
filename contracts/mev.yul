object "MEV" {
    code {
        // weth address
        sstore(0, calldataload(4))
        // owner
        sstore(1, caller())
        datacopy(0, dataoffset("runtime"), datasize("runtime"))
        return(0, datasize("runtime"))
    }
    object "runtime" {
        code {
            switch getselector()
            case 0x1de3df2c {
                // function depositWETH() external payable
                let weth := sload(0)
                // deposit() selector 
                mstore(0x80, 0xd0e30db0)
                let success := call(gas(), weth, callvalue(), 0x9c, 4, 0, 0)
                if iszero(success) {
                    revert(0, 0)
                }
            }
            case 0xfc4dd333 {
                // function withdrawWETH(uint amount)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                let weth := sload(0)
                mstore(0x80, 0x2e1a7d4d)
                mstore(0xa0, calldataload(4))
                let success := call(gas(), weth, 0, 0x9c, 0x24, 0, 0)
                if iszero(success) {
                    revert(0, 0)
                }
                let amount := mload(0xa0)
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
                let success := call(gas(), caller(), balance(address()), 0, 0, 0, 0)
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

                // call transferFrom function in the input token contract
                // bytes4(keccak256("transferFrom(address,address,uint256)")) = 0x23b872dd;
                let amountIn := calldataload(4)
                let pair := calldataload(0x44)
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
            default{
                revert(0, 0)
            }
            function getselector() -> selector {
                selector := shr(0xf8, calldataload(0))
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