const { BigNumber } = require("ethers");

const getAmountIn = (amountOut, reserveIn, reserveOut) => {
  if (amountOut.isZero()) {
    console.log("INSUFFICIENT_OUTPUT_AMOUNT");
    return BigNumber.from(0);
  }
  if (reserveIn.isZero() || reserveOut.isZero()) {
    console.log("INSUFFICIENT_LIQUIDITY");
    return BigNumber.from(0);
  }
  let numerator = reserveIn.mul(amountOut).mul(1000);
  let denominator = reserveOut.sub(amountOut).mul(997);
  amountIn = numerator.div(denominator).add(1);
};

const getAmountOut = (amountIn, reserveIn, reserveOut) => {
  if (amountIn.isZero()) {
    console.log("INSUFFICIENT_INPUT_AMOUNT");
    return BigNumber.from(0);
  }
  if (reserveIn.isZero() || reserveOut.isZero()) {
    console.log("INSUFFICIENT_LIQUIDITY");
    return BigNumber.from(0);
  }
  let amountInWithFee = amountIn.mul(997);
  let numerator = amountInWithFee.mul(reserveOut);
  let denominator = reserveIn.mul(1000).add(amountInWithFee);
  let amountOut = numerator.div(denominator);
  return amountOut;
};

module.exports = { getAmountIn, getAmountOut };
