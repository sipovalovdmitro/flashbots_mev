const { ethers, BigNumber } = require("ethers");
const { getAmountOut } = require("./amount.js");
const v2CreateSandwichPayloadWethIsInput = (
  pair,
  amountIn,
  reserveIn,
  reserveOut,
  isWeth0
) => {
  const amountInActual = amountIn.div(Math.pow(10, 5)).mul(Math.pow(10, 5));
  // console.log("Amount in:", amountIn);
  // console.log("Amount in actual:", amountInActual);
  const amountOut = getAmountOut(amountInActual, reserveIn, reserveOut);
  const [encodedTokenAmountOut, memoryOffset, amountAfterEncoding] =
    encodeNumToByteAndOffset(amountOut, 4, true, isWeth0);
  const swapType = v2FindFunctionSig(true, isWeth0);
  const payload = ethers.utils.solidityPack(
    ["uint8", "address", "uint8", "uint32"],
    [swapType, pair, memoryOffset, encodedTokenAmountOut]
  );
  const encodedValue = amountIn.div(Math.pow(10, 5));
  return [payload, encodedValue, amountAfterEncoding];
};

const v2CreateSandwichPayloadWethIsOutput = (
  pair,
  token,
  amountIn,
  reserveIn,
  reserveOut,
  isWeth0
) => {
  const [encodedAmountIn, memoryOffset, amountInActual] =
    encodeNumToByteAndOffset(amountIn, 4, false, isWeth0);
  const swapType = v2FindFunctionSig(false, isWeth0);
  const payload = ethers.utils.solidityPack(
    ["uint8", "address", "address", "uint8", "uint32"],
    [swapType, pair, token, memoryOffset, encodedAmountIn]
  );
  const amountOut = getAmountOut(amountInActual, reserveIn, reserveOut);
  const amountOutEncoded = amountOut.div(Math.pow(10, 5));
  return [payload, amountOutEncoded];
};

const encodeNumToByteAndOffset = (
  amount,
  numBytesToEncodeTo,
  isWethInput,
  isWethToken0
) => {
  let encodedAmount;
  let encodedByteOffset;
  let amountAfterEncoding;
  for (let i = 0; i < 32; i++) {
    encodedAmount = amount.div(BigNumber.from(2).pow(8 * i));
    if (encodedAmount.lt(BigNumber.from(2).pow(numBytesToEncodeTo * 8))) {
      encodedByteOffset = i;
      amountAfterEncoding = encodedAmount.mul(
        BigNumber.from(2).pow(encodedByteOffset * 8)
      );
      break;
    }
  }

  if (!isWethInput) {
    // find byte placement for Transfer(address,uint256)
    encodedByteOffset = 68 - numBytesToEncodeTo - encodedByteOffset;
  } else {
    if (isWethToken0) {
      encodedByteOffset = 68 - numBytesToEncodeTo - encodedByteOffset; // V2_Swap_Sig 0 amountOut
    } else {
      encodedByteOffset = 36 - numBytesToEncodeTo - encodedByteOffset; // V2_Swap_Sig amountOut 0
    }
  }
  return [encodedAmount, encodedByteOffset, amountAfterEncoding];
};

const v2FindFunctionSig = (isWethInput, isWeth0) => {
  const {
    V2_OUTPUT0_LABEL,
    V2_INPUT0_LABEL,
    V2_OUTPUT1_LABEL,
    V2_INPUT1_LABEL,
  } = require("../constant.js");
  if (isWethInput) {
    if (isWeth0) {
      return V2_INPUT0_LABEL;
    } else {
      return V2_INPUT1_LABEL;
    }
  } else {
    if (isWeth0) {
      return V2_OUTPUT0_LABEL;
    } else {
      return V2_OUTPUT1_LABEL;
    }
  }
};

module.exports = {
  v2CreateSandwichPayloadWethIsInput,
  v2CreateSandwichPayloadWethIsOutput,
};
