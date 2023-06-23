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
                datacopy(0, datasize("runtime"), 0x20)
                return(0, 0x20)
            }
            case 0x8da5cb5b {
                // function owner()
                datacopy(0, add(datasize("runtime"), 0x20), 0x20)
                return(0, 0x20)
            }
            case 0x1de3df2c {
                // function depositWETH() external payable
                if eq(callvalue(), 0) {
                    revert(0, 0)
                }
                let weth := getweth()
                // deposit() selector 
                mstore(0, 0xd0e30db000000000000000000000000000000000000000000000000000000000)
                let success := call(gas(), weth, callvalue(), 0, 4, 0, 0)
                if iszero(success) {
                    revert(0, 0)
                }
            }
            case 0xfc4dd333 {
                // function withdrawWETH(uint amount)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                let weth := getweth()
                let amount := calldataload(4)
                mstore(0, 0x2e1a7d4d00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, amount)
                let success := call(gas(), weth, 0, 0x00, 0x24, 0, 0)
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
            case 0xe3834899 {
                // function v2WethOutput0(uint amountIn, uint amountOut, address pair, address tokenIn)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                // weth address
                let weth := getweth()
                let amountIn := calldataload(0x4)
                let amountOut := calldataload(0x24)
                let pair := calldataload(0x44)
                let tokenIn := calldataload(0x64)

                // call transfer function from the input token contract
                // bytes4(keccak256("transfer(address,uint256)")) = 0xa9059cbb;
                mstore(0x00, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, pair)
                mstore(0x24, amountIn)
                let success := call(gas(), tokenIn, 0, 0x00, 0x44, 0x60, 0x20)
                let result := mload(0x60)
                if or(iszero(success), iszero(result)) {
                    revert(0, 0)
                }

                // swap
                // bytes4(keccak256("swap(uint256,uint256,address,bytes)")) = 0x022c0d9f;
                mstore(0x00, 0x022c0d9f00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, amountOut)
                mstore(0x24, 0)
                mstore(0x44, address())
                mstore(0x64, 0x80)
                mstore(0x84, 0x00)
                success := call(
                    gas(),
                    pair,
                    0,
                    0x00,
                    0xa4,
                    0x0,
                    0x0
                )
                if iszero(success) {
                    revert(0, 0)
                }

            }
            case 0x7af1c926 {
                // function v2WethInput0(uint amountIn, uint amountOut, address pair)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                // weth address
                let weth := getweth()
                let amountIn := calldataload(0x4)
                let amountOut := calldataload(0x24)
                let pair := calldataload(0x44)
                // call transferFrom function from the input token contract
                // bytes4(keccak256("transferFrom(address,address,uint256)")) = 0x23b872dd;
                mstore(0x00, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, address())
                mstore(0x24, pair)
                mstore(0x44, amountIn)
                let success := call(gas(), weth, 0, 0x00, 0x64, 0x80, 0x20)
                let result := mload(0x80)
                if or(iszero(success), iszero(result)) {
                    revert(0, 0)
                }

                // swap
                // bytes4(keccak256("swap(uint256,uint256,address,bytes)")) = 0x022c0d9f;
                mstore(0x00, 0x022c0d9f00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, 0)
                mstore(0x24, amountOut)
                mstore(0x44, address())
                mstore(0x64, 0x80)
                mstore(0x84, 0x00)
                success := call(
                    gas(),
                    pair,
                    0,
                    0x00,
                    0xa4,
                    0x0,
                    0x0
                )
                if iszero(success) {
                    revert(0, 0)
                }
            }
            case 0x65574700 {
                // function v2WethOutput1(uint amountIn, uint amountOut, address pair, address tokenIn)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                // weth address
                let weth := getweth()
                let amountIn := calldataload(0x4)
                let amountOut := calldataload(0x24)
                let pair := calldataload(0x44)
                let tokenIn := calldataload(0x64)
                // call transfer function from the input token contract
                // bytes4(keccak256("transfer(address,uint256)")) = 0xa9059cbb;
                mstore(0x00, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, pair)
                mstore(0x24, amountIn)
                let success := call(gas(), tokenIn, 0, 0x00, 0x44, 0x60, 0x20)
                let result := mload(0x60)
                if or(iszero(success), iszero(result)) {
                    revert(0, 0)
                }

                // swap
                // bytes4(keccak256("swap(uint256,uint256,address,bytes)")) = 0x022c0d9f;
                mstore(0x00, 0x022c0d9f00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, 0)
                mstore(0x24, amountOut)
                mstore(0x44, address())
                mstore(0x64, 0x80)
                mstore(0x84, 0x00)
                success := call(
                    gas(),
                    pair,
                    0,
                    0x00,
                    0xa4,
                    0x0,
                    0x0
                )
                if iszero(success) {
                    revert(0, 0)
                }
            }
            case 0x0971ad16 {
                // function v2WethInput1(uint amountIn, uint amountOut, address pair)
                if iszero(calledbyowner()) {
                    revert(0, 0)
                }
                // weth address
                let weth := getweth()
                let amountIn := calldataload(0x4)
                let amountOut := calldataload(0x24)
                let pair := calldataload(0x44)
                // call transferFrom function from the input token contract
                // bytes4(keccak256("transferFrom(address,address,uint256)")) = 0x23b872dd;
                mstore(0x00, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, address())
                mstore(0x24, pair)
                mstore(0x44, amountIn)
                let success := call(gas(), weth, 0, 0x00, 0x64, 0x80, 0x20)
                let result := mload(0x80)
                if or(iszero(success), iszero(result)) {
                    revert(0, 0)
                }

                // swap
                // bytes4(keccak256("swap(uint256,uint256,address,bytes)")) = 0x022c0d9f;
                mstore(0x00, 0x022c0d9f00000000000000000000000000000000000000000000000000000000)
                mstore(0x4, amountOut)
                mstore(0x24, 0)
                mstore(0x44, address())
                mstore(0x64, 0x80)
                mstore(0x84, 0x00)
                success := call(
                    gas(),
                    pair,
                    0,
                    0x00,
                    0xa4,
                    0x0,
                    0x0
                )
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