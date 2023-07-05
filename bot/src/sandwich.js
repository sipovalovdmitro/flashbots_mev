const clc = require("cli-color");
const dotenv = require("dotenv");
dotenv.config();
const { Wallet, ethers, BigNumber } = require("ethers");
const {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} = require("@flashbots/ethers-provider-bundle");
const { getPair } = require("../helpers/utils/pair.js");
const {
  getAmountOut,
  getWETHOptimalIn,
} = require("../helpers/utils/amount.js");
const { decodeUniversalRouterSwap } = require("../helpers/utils/decoding.js");
const {
  v2CreateSandwichPayloadWethIsInput,
  v2CreateSandwichPayloadWethIsOutput,
} = require("../helpers/utils/payload.js");
// 1.1 const ABIs and Bytecodes
const {
  pairAbi,
  pairBytecode,
  uniswapV3Abi,
  erc20Abi,
} = require("../helpers/abis/abi.js");

const mevAbi = require("../build/mev.abi.json");
const mevByteCode = require("../build/mev.bytecode.json");

// 1.2 Setup user modifiable variables
// goerli
// const flashbotsUrl = "https://relay-goerli.flashbots.net";
// const wethAddress = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
// const mevAddress = "0xD129cD4261F2813b65D18b96b5A95B8352205449";
// const uniswapFactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
// const universalRouterAddress = "0x4648a43B2C14Da09FdF82B161150d3F634f40491";
// const httpProviderUrl = process.env.GOERLI_HTTP_PROVIDER_URL;
// const wsProviderUrl = process.env.GOERLI_WS_PROVIDER_URL;
// const chainId = 5;

// mainnet
const flashbotsUrl = "https://relay.flashbots.net";
const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const mevAddress = "0x62f7F4b476ae0781344e4c1A950C05895f4Ea93D";
const uniswapFactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const universalRouterAddress = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
const metaSwap = "0x881D40237659C251811CEC9c364ef91dC08D300C";
const universalRouterAddress1 = "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B";
const zeroExProxy = "0xe66B31678d6C16E9ebf358268a790B763C133750";
const httpProviderUrl = process.env.MAINNET_HTTP_PROVIDER_URL;
const wsProviderUrl = process.env.MAINNET_WS_PROVIDER_URL;
const chainId = 1;

const privateKey = process.env.PRIVATE_KEY;
// const bribeToMiners = ethers.utils.parseUnits("80", "gwei");

const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);

const searcher = new Wallet(privateKey).connect(provider);
const uniswapV3Interface = new ethers.utils.Interface(uniswapV3Abi);

const pairFactory = new ethers.ContractFactory(pairAbi, pairBytecode, searcher);

const mev = new ethers.ContractFactory(mevAbi, mevByteCode, searcher).attach(
  mevAddress
);
// const mev = new ethers.Contract(mevAddress, mevAbi, signingWallet);
const wethContract = new ethers.Contract(wethAddress, erc20Abi, searcher);
var flashbotsProvider = null;
var mevWethBalance = 0;
var concurrency = 0;

// Setup initial checks
const initialChecks = async (tx) => {
  let transaction = null;
  let decoded = null;
  let decodedSwap = null;
  try {
    transaction = await provider.getTransaction(tx);
  } catch (error) {
    return false;
  }

  if (!transaction || !transaction.to) return false;

  if (Number(transaction.value) == 0) return false;

  if (transaction.to.toLowerCase() != universalRouterAddress.toLowerCase())
    return false;

  try {
    decoded = uniswapV3Interface.parseTransaction(transaction);
  } catch (error) {
    return false;
  }
  // If the swap is not for uniswapV2 we return it.
  if (!decoded.args.commands.includes("08")) {
    return false;
  }
  let swapPositionInCommands =
    decoded.args.commands.substring(2).indexOf("08") / 2;
  let input = decoded.args.inputs[swapPositionInCommands];
  decodedSwap = decodeUniversalRouterSwap(input);
  if (!decodedSwap.hasTwoPath) return false;
  // // we only need the transactions to swap ETH for tokens
  // if (decodedSwap.recipient === 2) {
  //   return false;
  // }
  if (decodedSwap.path[0].toLowerCase() != wethAddress.toLowerCase())
    return false;
  if (decodedSwap.amountIn.lt(ethers.utils.parseEther("0.5"))) return false;
  return {
    transaction,
    amountIn: transaction.value,
    minAmountOut: decodedSwap.minAmountOut,
    tokenToCapture: decodedSwap.path[1],
  };
};

const processTransaction = async (tx) => {
  const checksPassed = await initialChecks(tx);
  if (!checksPassed) {
    return;
  }
  // console.time(`${tx} time consume`)
  const { transaction, amountIn, minAmountOut, tokenToCapture } = checksPassed;
  // get pair address

  const pairAddress = getPair(
    uniswapFactoryAddress,
    wethAddress,
    tokenToCapture
  );

  // get pair reserves
  const pair = pairFactory.attach(pairAddress);

  let reserves = null;
  try {
    reserves = await pair.getReserves();
  } catch (error) {
    return;
  }

  let reserveWETH;
  let reserveToken;
  let isWeth0;
  if (wethAddress < tokenToCapture) {
    isWeth0 = true;
    reserveWETH = reserves._reserve0;
    reserveToken = reserves._reserve1;
  } else {
    isWeth0 = false;
    reserveWETH = reserves._reserve1;
    reserveToken = reserves._reserve0;
  }
  if (reserveWETH.isZero() || reserveToken.isZero()) {
    return;
  }

  // set searcher eth amount in
  var searcherWethAmountIn;
  try {
    searcherWethAmountIn = getWETHOptimalIn(
      mevWethBalance,
      amountIn,
      minAmountOut,
      reserveWETH,
      reserveToken
    );
  } catch (error) {
    return;
  }
  if (searcherWethAmountIn.isZero()) return;
  searcherWethAmountIn = searcherWethAmountIn
    .div(Math.pow(10, 5))
    .mul(Math.pow(10, 5));
  console.log(
    `${tx} Searcher WETH Amount In:`,
    ethers.utils.formatEther(searcherWethAmountIn)
  );
  console.log(
    `${tx} Victim WETH Amount In:`,
    ethers.utils.formatEther(amountIn)
  );
  // Prepare first transaction
  const [frontrunTransactionPayload, encodedValue, amountAfterEncoding] =
    v2CreateSandwichPayloadWethIsInput(
      pairAddress,
      searcherWethAmountIn,
      reserveWETH,
      reserveToken,
      isWeth0
    );
  // Buy using your ETH amount and calculate token amount out
  var searcherTokenAmountOut = amountAfterEncoding;
  if (searcherTokenAmountOut.isZero()) {
    console.log("searcher token amount out is zero");
    // console.timeEnd(`${tx} time consume`)
    return;
  }

  const updatedReserveWETH = reserveWETH.add(searcherWethAmountIn);
  const updatedReserveToken = reserveToken.sub(searcherTokenAmountOut);
  const victimAmountOut = getAmountOut(
    amountIn,
    updatedReserveWETH,
    updatedReserveToken
  );

  if (victimAmountOut.lt(minAmountOut)) {
    // console.timeEnd(`${tx} time consume`)
    console.log(`${tx} Victim would get less than the minimum amount out`);
    return;
  }

  const updatedReserveWETH2 = updatedReserveWETH.add(amountIn);
  const updatedReserveToken2 = updatedReserveToken.sub(victimAmountOut);
  // Prepare the last selling back transaction
  const [backrunTransactionPayload, searcherWethAmountOutEncoded] =
    v2CreateSandwichPayloadWethIsOutput(
      pairAddress,
      tokenToCapture,
      searcherTokenAmountOut,
      updatedReserveToken2,
      updatedReserveWETH2,
      isWeth0
    );

  const searcherWethAmountOut = searcherWethAmountOutEncoded.mul(
    Math.pow(10, 5)
  );

  if (searcherWethAmountOut.lt(searcherWethAmountIn)) {
    console.log(
      `${tx} The searcher would get less ETH out than in without accounting for gas fee`
    );
    // console.timeEnd(`${tx} time consume`)
    return;
  }

  // Calculate reasonable gas fee
  var blockNumber;
  var block;
  try {
    blockNumber = await provider.getBlockNumber();
    block = await provider.getBlock(blockNumber);
  } catch (error) {
    return;
  }
  const nextBaseFee = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
    block.baseFeePerGas,
    1
  );

  if (transaction.type === 0 || !transaction.type) {
    // console.timeEnd(`${tx} time consume`)
    return;
  }
  const nonce = await provider.getTransactionCount(searcher.address);

  let frontrunTx = {
    to: mevAddress,
    from: searcher.address,
    value: encodedValue,
    data: frontrunTransactionPayload,
    chainId: 1,
    maxPriorityFeePerGas: 0,
    maxFeePerGas: nextBaseFee,
    gasLimit: 300000,
    nonce,
    type: 2,
  };
  let frontrunTxSigned = {
    signer: searcher,
    transaction: frontrunTx,
  };

  // Prepare victim transaction
  let victimTransactionWithChainId = {
    ...transaction,
    chainId,
  };

  let victimTxSigned;
  try {
    victimTxSigned = {
      signedTransaction: ethers.utils.serializeTransaction(
        victimTransactionWithChainId,
        {
          r: victimTransactionWithChainId.r,
          s: victimTransactionWithChainId.s,
          v: victimTransactionWithChainId.v,
        }
      ),
    };
  } catch (error) {
    return;
  }

  let backrunTx = {
    to: mevAddress,
    from: searcher.address,
    data: backrunTransactionPayload,
    value: searcherWethAmountOutEncoded,
    chainId: 1,
    maxPriorityFeePerGas: 0,
    maxFeePerGas: nextBaseFee,
    gasLimit: 300000,
    nonce: nonce + 1,
    type: 2,
  };
  let backrunTxSigned = {
    signer: searcher,
    transaction: backrunTx,
  };

  // Send transaction bundle with flashbots
  var transactionBundle = [frontrunTxSigned, victimTxSigned, backrunTxSigned];

  var signedTransactions = await flashbotsProvider.signBundle(
    transactionBundle
  );
  console.log(clc.yellowBright.underline(`${tx} Simulating...`));
  try {
    const simulation = await flashbotsProvider.simulate(
      signedTransactions,
      blockNumber + 1
    );
    if (simulation.firstRevert) {
      console.log(
        clc.red(`${tx} Simulation error:`, simulation.firstRevert.error)
      );
      // console.timeEnd(`${tx} time consume`)
      return;
    } else {
      if (simulation.error) {
        console.log(
          clc.red(`${tx} Simulation error:`, simulation.error.message)
        );
        // console.timeEnd(`${tx} time consume`)
        return;
      }
      console.log(clc.yellow(`${tx} Simulation Success`));

      console.log(
        clc.yellow(
          `${tx} Total gas used: ${simulation.results[0].gasUsed} + ${simulation.results[2].gasUsed}`
        )
      );
      const profit = searcherWethAmountOut.sub(searcherWethAmountIn);
      const searcherMaxFeePerGas = profit
        .sub(nextBaseFee.mul(simulation.results[0].gasUsed))
        .mul(9900)
        .div(10000)
        .div(simulation.results[2].gasUsed);
      if (searcherMaxFeePerGas.lt(nextBaseFee)) {
        console.log(`${tx} Insufficient profit to bribe to miners`);
        // console.timeEnd(`${tx} time consume`)
        return;
      } else {
        console.log(clc.green(`${tx} The searcher would get profit`));
        console.log(
          clc.green(
            `${tx} searcher ETH in : ${ethers.utils.formatEther(
              searcherWethAmountIn
            )}`
          )
        );
        console.log(
          clc.green(
            `${tx} searcher max priority fee per gas: ${ethers.utils.formatUnits(
              searcherMaxFeePerGas.sub(nextBaseFee),
              9
            )} gwei`
          )
        );
        console.log(
          clc.green(
            `${tx} searcher ETH out: ${ethers.utils.formatEther(
              searcherWethAmountOut
            )}`
          )
        );
        backrunTx = {
          to: mevAddress,
          from: searcher.address,
          data: backrunTransactionPayload,
          value: searcherWethAmountOutEncoded,
          chainId: 1,
          maxPriorityFeePerGas: searcherMaxFeePerGas.sub(nextBaseFee),
          maxFeePerGas: searcherMaxFeePerGas,
          gasLimit: 300000,
          nonce: nonce + 1,
          type: 2,
        };
        backrunTxSigned = {
          signer: searcher,
          transaction: backrunTx,
        };
        transactionBundle = [frontrunTxSigned, victimTxSigned, backrunTxSigned];
        signedTransactions = await flashbotsProvider.signBundle(
          transactionBundle
        );

        let bundleSubmission;

        flashbotsProvider
          .sendRawBundle(signedTransactions, blockNumber + 1)
          .then((_bundleSubmission) => {
            bundleSubmission = _bundleSubmission;
            console.log(
              clc.blue(`${tx} Bundle submitted ${bundleSubmission.bundleHash}`)
            );
            return bundleSubmission.wait();
          })
          .then(async (waitResponse) => {
            console.log(
              clc.blue(
                `${tx} Wait response ${FlashbotsBundleResolution[waitResponse]}`
              )
            );
            if (waitResponse == FlashbotsBundleResolution.BundleIncluded) {
              console.log(
                clc.blueBright("-------------------------------------------")
              );
              console.log(
                clc.blueBright("-------------------------------------------")
              );
              console.log(
                clc.blueBright("----------- Bundle Included ---------------")
              );
              console.log(
                clc.blueBright("-------------------------------------------")
              );
              console.log(
                clc.blueBright("-------------------------------------------")
              );
            } else if (
              waitResponse == FlashbotsBundleResolution.AccountNonceTooHigh
            ) {
              console.log(
                `${tx} The victim transaction has been confirmed already`
              );
            } else {
              console.log(`${tx} Bundle hash, ${bundleSubmission.bundleHash}`);
              // console.log({
              //   bundleStats: await flashbotsProvider.getBundleStats(
              //     bundleSubmission.bundleHash,
              //     blockNumber + 1
              //   ),
              //   userStats: await flashbotsProvider.getUserStats(),
              // });
            }
          });
        // console.timeEnd(`${tx} time consume`);
      }
    }
  } catch (error) {
    console.log(error.message);
    return;
  }
};

const start = async () => {
  // if (isMainThread) {
  console.log("searcher address:", searcher.address);
  console.log("Listening on transaction for the chain id", chainId);
  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    searcher,
    flashbotsUrl
  );
  mevWethBalance = await wethContract.balanceOf(mevAddress);

  console.log(
    "WETH balance of the mev contract:",
    ethers.utils.formatEther(mevWethBalance)
  );

  const wsProvider = new ethers.providers.WebSocketProvider(wsProviderUrl);
  wsProvider
    .on("pending", async (tx) => {
      if (concurrency < 50) {
        concurrency++;
        await processTransaction(tx);
        concurrency--;
      }
    })
    ._websocket.on("close", () => {
      start().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    });
};

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// - Use multiple block builders besides flashbots
// - Use multiple cores from your computer to improve performance
// - Implement multiple dexes like uniswap, shibaswap, sushiswap and others
