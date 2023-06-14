const { ethers } = require("ethers");

// Decode uniswap universal router transactions
const decodeUniversalRouterSwap = (input) => {
    const abiCoder = new ethers.utils.AbiCoder();

    // 0000000000000000000000000000000000000000000000000000000000000001
    // 000000000000000000000000000000000000000000000000003ff2e795f50000
    // 000000000000000000000000000000000000000000051a502ee360863de67514
    // 00000000000000000000000000000000000000000000000000000000000000a0
    // 0000000000000000000000000000000000000000000000000000000000000000
    // 0000000000000000000000000000000000000000000000000000000000000002
    // 000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
    // 0000000000000000000000002b7d7825a3c57229c07910408d1356ef64407827

    const decodedParameters = abiCoder.decode(
        ["address", "uint256", "uint256", "address[]", "bool"],
        input
    );
    // const breakdown = input.substring(2).match(/.{1,64}/g);

    let path = decodedParameters[3];
    let hasTwoPath = true;
    if (path.length != 2) {
        hasTwoPath = false;
    }

    return {
        recipient: parseInt(decodedParameters[0], 16),
        amountIn: decodedParameters[1],
        minAmountOut: decodedParameters[2],
        path,
        hasTwoPath,
    };
};

// const decodeUniversalRouterSwap = (input) => {
//     const abiCoder = new ethers.utils.AbiCoder();
  
    // 0000000000000000000000000000000000000000000000000000000000000001
    // 000000000000000000000000000000000000000000000000003ff2e795f50000
    // 000000000000000000000000000000000000000000051a502ee360863de67514
    // 00000000000000000000000000000000000000000000000000000000000000a0
    // 0000000000000000000000000000000000000000000000000000000000000000
    // 0000000000000000000000000000000000000000000000000000000000000002
    // 000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
    // 0000000000000000000000002b7d7825a3c57229c07910408d1356ef64407827
  
    // const decodedParameters = abiCoder.decode(
    //   ["address", "uint256", "uint256", "bytes", "bool"],
    //   input
    // );

//     const breakdown = input.substring(2).match(/.{1,64}/g);
  
//     let path = [];
//     let hasTwoPath = true;
//     if (breakdown.length <= 9) {
//       const pathOne = "0x" + breakdown[breakdown.length - 2].substring(24);
//       const pathTwo = "0x" + breakdown[breakdown.length - 1].substring(24);
//       path = [pathOne, pathTwo];
//     } else {
//       hasTwoPath = false;
//     }
  
//     return {
//       recipient: parseInt(decodedParameters[0], 16),
//       amountIn: decodedParameters[1],
//       minAmountOut: decodedParameters[2],
//       path,
//       hasTwoPath,
//     };
//   };

// Decode sushiswap route processor transactions

module.exports = { decodeUniversalRouterSwap }