
const getAmountIn = (amountOut, reserveIn, reserveOut) => {
    if(amountOut <= 0) {
        console.log('INSUFFICIENT_OUTPUT_AMOUNT');
        return 0;

    }
    if (reserveIn <= 0 || reserveOut <= 0) {
        console.log("INSUFFICIENT_LIQUIDITY");
        return 0;
      }
    let numerator = reserveIn.mul(amountOut).mul(1000);
    let denominator = reserveOut.sub(amountOut).mul(997);
    amountIn = (numerator / denominator).add(1);
}

const getAmountOut = (amountIn, reserveIn, reserveOut) => {
    if (amountIn <= 0) {
      console.log("INSUFFICIENT_INPUT_AMOUNT");
      return 0;
    }
    if (reserveIn <= 0 || reserveOut <= 0) {
      console.log("INSUFFICIENT_LIQUIDITY");
      return 0;
    }
    let amountInWithFee = amountIn.mul(997);
    let numerator = amountInWithFee.mul(reserveOut);
    let denominator = reserveIn.mul(1000).add(amountInWithFee);
    let amountOut = numerator.div(denominator);
    return amountOut;
  };

module.exports = {getAmountIn, getAmountOut}