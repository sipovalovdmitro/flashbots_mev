object "MEV" {
    code {
        // constructor(address weth, address owner)
        codecopy(datasize("runtime"), sub(codesize(), 64), 64)

        // copy runtime code
        datacopy(0, dataoffset("runtime"), datasize("runtime"))

        // return runtime code and shoehorned immutable variable
        return(0, add(datasize("runtime"), 64))
    }
    object "runtime" {
        code {
            switch getselector()
            case 0x7d5aa5f4 {
                // function wethAddr()
                mstore(0x40, 0x80)
                let ptr := mload(0x40)
                datacopy(ptr, datasize("runtime"), 0x20)
                mstore(0x40, add(ptr, 0x20))
                return(ptr, 0x20)
            }
            case 0x8da5cb5b {
                // function owner()
                mstore(0x40, 0x80)
                let ptr := mload(0x40)
                datacopy(ptr, add(datasize("runtime"), 0x20), 0x20)
                mstore(0x40, add(ptr, 0x20))
                return(ptr, 0x20)
            }
            case 0x1de3df2c {
                // function depositWETH() external payable
                mstore(0x40, 0x80)
                if eq(callvalue(), 0) {
                    revert(0, 0)
                }
                let weth := getweth()
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
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                let weth := getweth()
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
            case 0xe63ede0b {
                mstore(0x40, 0x80)
                // swapExactTokensForTokens(uint256,uint256,address,address,bool,uint256)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                // weth address
                let weth := getweth()
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
                
                // swap
                let amountOutMin := calldataload(0x24)
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
                datacopy(0, add(datasize("runtime"), 0x20), 0x20)
                let owner := mload(0)
                cbo := eq(owner, caller())
            }
            function getweth() -> weth {
                datacopy(0, datasize("runtime"), 0x20)
                weth := mload(0)
            }
        }
    }
}