const { ethers, BigNumber } = require("ethers");

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

const binarySearch = (
  left, // Lower bound
  right, // Upper bound
  calculateF, // Generic calculate function
  passConditionF, // Condition checker
  tolerance = ethers.utils.parseEther("0.01") // Tolerable delta (in %, in 18 dec, i.e. parseUnits('0.01') means left and right delta can be 1%)
) => {
  const BN_18 = ethers.utils.parseEther("1");
  if (right.sub(left).gt(tolerance.mul(right.add(left).div(2)).div(BN_18))) {
    const mid = right.add(left).div(2);
    const out = calculateF(mid);

    // If we pass the condition
    // Number go up
    if (passConditionF(out)) {
      return binarySearch(mid, right, calculateF, passConditionF, tolerance);
    }

    // Number go down
    return binarySearch(left, mid, calculateF, passConditionF, tolerance);
  }

  // No negatives
  const ret = right.add(left).div(2);
  if (ret.lt(0)) {
    return ethers.constants.Zero;
  }

  return ret;
};

const getWETHOptimalIn = (
  attackerWETHBalance,
  victimAmountIn,
  victimAmountOutMin,
  reserveWeth,
  reserveToken
) => {
  // Note that user is going from WETH -> TOKEN
  // So, we'll be pushing the price of TOKEn
  // by swapping WETH -> TOKEN before the user
  // i.e. Ideal tx placement:
  // 1. (Ours) WETH -> TOKEN (pushes up price)
  // 2. (Victim) WETH -> TOKEN (pushes up price more)
  // 3. (Ours) TOKEN -> WETH (sells TOKEN for slight WETH profit)
  const calcF = (amountIn) => {
    const frontrunState = getUniv2DataGivenIn(
      amountIn,
      reserveWeth,
      reserveToken
    );
    const victimState = getUniv2DataGivenIn(
      victimAmountIn,
      frontrunState.newReserveA,
      frontrunState.newReserveB
    );
    return victimState.amountOut;
  };

  // Our binary search must pass this function
  // i.e. User must receive at least min this
  const passF = (amountOut) => amountOut.gte(victimAmountOutMin);

  // Lower bound will be 0
  // Upper bound will be 100 ETH (hardcoded, or however much ETH you have on hand)
  // Feel free to optimize and change it
  // It shouldn't be hardcoded hehe....
  const lowerBound = ethers.utils.parseEther("0");
  const upperBound = attackerWETHBalance;

  // Optimal WETH in to push reserve to the point where the user
  // _JUST_ receives their min recv
  const optimalWethIn = binarySearch(lowerBound, upperBound, calcF, passF);

  return optimalWethIn;
};

const getUniv2DataGivenIn = (aIn, reserveA, reserveB) => {

  const aInWithFee = aIn.mul(997);
  const numerator = aInWithFee.mul(reserveB);
  const denominator = aInWithFee.add(reserveA.mul(1000));
  const bOut = numerator.div(denominator);

  // Underflow
  let newReserveB = reserveB.sub(bOut);
  if (newReserveB.lt(0) || newReserveB.gt(reserveB)) {
    newReserveB = ethers.BigNumber.from(1);
  }

  // Overflow
  let newReserveA = reserveA.add(aIn);
  if (newReserveA.lt(reserveA)) {
    newReserveA = ethers.constants.MaxInt256;
  }

  return {
    amountOut: bOut,
    newReserveA,
    newReserveB,
  };
};


module.exports = { getAmountIn, getAmountOut, getWETHOptimalIn };
