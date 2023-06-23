const clc = require("cli-color");
const dotenv = require("dotenv");
dotenv.config();
const { Wallet, ethers } = require("ethers");
const {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} = require("@flashbots/ethers-provider-bundle");
const { getPair } = require("../helpers/utils/pair.js");
const { getAmountOut, getWETHOptimalIn } = require("../helpers/utils/amount.js");
const { decodeUniversalRouterSwap } = require("../helpers/utils/decoding.js");
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
const mevAddress = "0xBf257af05b4DeedAeCc748ab1A8bBDed7465B7f6";
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


const signingWallet = new Wallet(privateKey).connect(provider);
const uniswapV3Interface = new ethers.utils.Interface(uniswapV3Abi);

const pairFactory = new ethers.ContractFactory(
  pairAbi,
  pairBytecode,
  signingWallet
);

const mev = new ethers.ContractFactory(mevAbi, mevByteCode, signingWallet).attach(mevAddress);
// const mev = new ethers.Contract(mevAddress, mevAbi, signingWallet);
const wethContract = new ethers.Contract(wethAddress, erc20Abi, signingWallet);
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
  if (decodedSwap.amountIn.lt(ethers.utils.parseEther('0.5'))) return false;
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

  // set attacker eth amount in
  var attackerWETHAmountIn;
  try {
    attackerWETHAmountIn = getWETHOptimalIn(mevWethBalance, amountIn, minAmountOut, reserveWETH, reserveToken)
  } catch (error) {
    return;
  }
  if (attackerWETHAmountIn.isZero()) return;
  console.log(
    `${tx} Attacker WETH Amount In:`,
    ethers.utils.formatEther(attackerWETHAmountIn)
  );
  console.log(
    `${tx} Victim WETH Amount In:`,
    ethers.utils.formatEther(amountIn)
  );

  // Buy using your ETH amount and calculate token amount out
  const attackerTokenAmountOut = getAmountOut(
    attackerWETHAmountIn,
    reserveWETH,
    reserveToken
  );
  if (attackerTokenAmountOut.isZero()) {
    console.log("Attacker token amount out is zero");
    // console.timeEnd(`${tx} time consume`)
    return;
  }

  const updatedReserveWETH = reserveWETH.add(attackerWETHAmountIn);
  const updatedReserveToken = reserveToken.sub(
    attackerTokenAmountOut
  );
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
  const updatedReserveToken2 = updatedReserveToken.sub(
    victimAmountOut
  );

  const attackerWETHAmountOut = getAmountOut(
    attackerTokenAmountOut,
    updatedReserveToken2,
    updatedReserveWETH2
  );

  if (attackerWETHAmountOut.lt(attackerWETHAmountIn)) {
    console.log(
      `${tx} The attacker would get less ETH out than in without accounting for gas fee`
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

  // Prepare first transaction
  let frontrunTransaction
  if(isWeth0){
    frontrunTransaction = {
      signer: signingWallet,
      transaction: await mev.populateTransaction.v2WethInput0(
        attackerWETHAmountIn,
        attackerTokenAmountOut,
        pairAddress,
        {
          value: "0",
          type: 2,
          maxFeePerGas: nextBaseFee,
          maxPriorityFeePerGas: 0,
          gasLimit: 300000
        }
      ),
    };
  }else{
    frontrunTransaction = {
      signer: signingWallet,
      transaction: await mev.populateTransaction.v2WethInput1(
        attackerWETHAmountIn,
        attackerTokenAmountOut,
        pairAddress,
        {
          value: "0",
          type: 2,
          maxFeePerGas: nextBaseFee,
          maxPriorityFeePerGas: 0,
          gasLimit: 300000
        }
      ),
    };
  }

  frontrunTransaction.transaction = {
    ...frontrunTransaction.transaction,
    chainId,
  };

  // Prepare victim transaction
  let victimTransactionWithChainId = {
    ...transaction,
    chainId,
  };

  let signedVictimTransaction;
  // try {
  signedVictimTransaction = {
    signedTransaction: ethers.utils.serializeTransaction(
      victimTransactionWithChainId,
      {
        r: victimTransactionWithChainId.r,
        s: victimTransactionWithChainId.s,
        v: victimTransactionWithChainId.v,
      }
    ),
  };
  // } catch (error) {
  //   return;
  // }

  // Prepare the last selling back transaction
  let backrunTransaction
  if(isWeth0){
    backrunTransaction= {
      signer: signingWallet,
      transaction: await mev.populateTransaction.v2WethOutput0(
        attackerTokenAmountOut,
        attackerWETHAmountOut,
        pairAddress,
        tokenToCapture,
        {
          value: "0",
          type: 2,
          maxFeePerGas: nextBaseFee,
          maxPriorityFeePerGas: 0,
          gasLimit: 300000
        }
      ),
    };
  }else{
    backrunTransaction= {
      signer: signingWallet,
      transaction: await mev.populateTransaction.v2WethOutput1(
        attackerTokenAmountOut,
        attackerWETHAmountOut,
        pairAddress,
        tokenToCapture,
        {
          value: "0",
          type: 2,
          maxFeePerGas: nextBaseFee,
          maxPriorityFeePerGas: 0,
          gasLimit: 300000
        }
      ),
    };
  }
  

  backrunTransaction.transaction = {
    ...backrunTransaction.transaction,
    chainId,
  };

  // Send transaction bundle with flashbots
  var transactionBundle = [
    frontrunTransaction,
    signedVictimTransaction,
    backrunTransaction,
  ];

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
      console.log(clc.red(`${tx} Simulation error:`, simulation.firstRevert.error));
      // console.timeEnd(`${tx} time consume`)
      return;
    } else {
      if (simulation.error) {
        console.log(clc.red(`${tx} Simulation error:`, simulation.error.message));
        // console.timeEnd(`${tx} time consume`)
        return;
      }
      console.log(clc.yellow(`${tx} Simulation Success`));

      // const totalGasFees = (attackerMaxFeePerGas.mul(
      //   simulation.results[2].gasUsed
      // )).add(nextBaseFee.mul(simulation.results[0].gasUsed));
      console.log(clc.yellow(`${tx} Total gas used: ${simulation.results[0].gasUsed} + ${simulation.results[2].gasUsed}`));
      const profit = attackerWETHAmountOut.sub(attackerWETHAmountIn);
      const attackerMaxFeePerGas = (profit.sub(nextBaseFee.mul(simulation.results[0].gasUsed))).mul(9900).div(10000).div(simulation.results[2].gasUsed);
      if (attackerMaxFeePerGas.lt(nextBaseFee)) {
        console.log(`${tx} Insufficient profit to bribe to miners`);
        // console.timeEnd(`${tx} time consume`)
        return;
      } else {
        console.log(clc.green(`${tx} The attacker would get profit`));
        console.log(clc.green(`${tx} Attacker ETH in : ${ethers.utils.formatEther(attackerWETHAmountIn)}`));
        console.log(clc.green(`${tx} Attacker max gas: ${ethers.utils.formatUnits(attackerMaxFeePerGas, 9)} gwei`));
        console.log(clc.green(`${tx} Attacker ETH out: ${ethers.utils.formatEther(attackerWETHAmountOut)}`));
        if(isWeth0){
          backrunTransaction= {
            signer: signingWallet,
            transaction: await mev.populateTransaction.v2WethOutput0(
              attackerTokenAmountOut,
              attackerWETHAmountOut,
              pairAddress,
              tokenToCapture,
              {
                value: "0",
                type: 2,
                maxFeePerGas: attackerMaxFeePerGas,
                maxPriorityFeePerGas: attackerMaxFeePerGas.sub(nextBaseFee),
                gasLimit: 300000
              }
            ),
          };
        }else{
          backrunTransaction= {
            signer: signingWallet,
            transaction: await mev.populateTransaction.v2WethOutput1(
              attackerTokenAmountOut,
              attackerWETHAmountOut,
              pairAddress,
              tokenToCapture,
              {
                value: "0",
                type: 2,
                maxFeePerGas: attackerMaxFeePerGas,
                maxPriorityFeePerGas: attackerMaxFeePerGas.sub(nextBaseFee),
                gasLimit: 300000
              }
            ),
          };
        }
        backrunTransaction.transaction = {
          ...backrunTransaction.transaction,
          chainId,
        };
        transactionBundle = [
          frontrunTransaction,
          signedVictimTransaction,
          backrunTransaction,
        ];
        signedTransactions = await flashbotsProvider.signBundle(
          transactionBundle
        );

        let bundleSubmission;

        flashbotsProvider
          .sendRawBundle(signedTransactions, blockNumber + 1)
          .then((_bundleSubmission) => {
            bundleSubmission = _bundleSubmission;
            console.log(clc.blue(`${tx} Bundle submitted ${bundleSubmission.bundleHash}`));
            return bundleSubmission.wait();
          })
          .then(async (waitResponse) => {
            console.log(clc.blue(`${tx} Wait response ${FlashbotsBundleResolution[waitResponse]}`));
            if (waitResponse == FlashbotsBundleResolution.BundleIncluded) {
              console.log(clc.blueBright("-------------------------------------------"));
              console.log(clc.blueBright("-------------------------------------------"));
              console.log(clc.blueBright("----------- Bundle Included ---------------"));
              console.log(clc.blueBright("-------------------------------------------"));
              console.log(clc.blueBright("-------------------------------------------"));
            } else if (
              waitResponse == FlashbotsBundleResolution.AccountNonceTooHigh
            ) {
              console.log(`${tx} The victim transaction has been confirmed already`);
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
        // console.timeEnd(`${tx} time consume`)
      }
    }


  } catch (error) {
    return;
  }
};

const start = async () => {
  // if (isMainThread) {
  console.log("Attacker address:", signingWallet.address);
  console.log("Listening on transaction for the chain id", chainId);
  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    signingWallet,
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
