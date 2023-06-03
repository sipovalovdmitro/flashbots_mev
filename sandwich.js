import os from "os";

import { Worker, isMainThread, workerData, parentPort } from "worker_threads";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
import dotenv from "dotenv";
dotenv.config();
import { Wallet, ethers } from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from "@flashbots/ethers-provider-bundle";
import { getPair } from "./helpers/utils/pair.js";

// 1.1 Import ABIs and Bytecodes
import {
  uniswapV2RouterAbi,
  uniswapBytecode,
  uniswapFactoryAbi,
  uniswapFactoryBytecode,
  pairAbi,
  pairBytecode,
  erc20Abi,
  erc20Bytecode,
  uniswapV3Abi,
} from "./helpers/abis/abi.js";

import { getAmountIn, getAmountOut } from "./helpers/utils/amount.js";

// 1.2 Setup user modifiable variables
// goerli
// const flashbotsUrl = "https://relay-goerli.flashbots.net";
// const wethAddress = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
// const uniswapAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // UniswapV2Router02
// const uniswapFactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
// const universalRouterAddress = "0x4648a43B2C14Da09FdF82B161150d3F634f40491";
// const httpProviderUrl = process.env.GOERLI_HTTP_PROVIDER_URL;
// const wsProviderUrl = process.env.GOERLI_WS_PROVIDER_URL;
// const chainId = 5;

// mainnet
const flashbotsUrl = "https://relay.flashbots.net";
const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const uniswapAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // UniswapV2Router02
const sushiswapAddress = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"; // UniswapV2Router02
const shibaswapAddress = "0x03f7724180AA6b939894B5Ca4314783B0b36b329"; // UniswapV2Router02
const uniswapFactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const universalRouterAddress = "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B";
const httpProviderUrl = process.env.MAINNET_HTTP_PROVIDER_URL;
const wsProviderUrl = process.env.MAINNET_WS_PROVIDER_URL;
const chainId = 1;

const privateKey = process.env.PRIVATE_KEY;
const bribeToMiners = ethers.utils.parseUnits("20", "gwei");

const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);
const wsProvider = new ethers.providers.WebSocketProvider(wsProviderUrl);

const signingWallet = new Wallet(privateKey).connect(provider);
const uniswapV3Interface = new ethers.utils.Interface(uniswapV3Abi);
const factoryUniswapFactory = new ethers.ContractFactory(
  uniswapFactoryAbi,
  uniswapFactoryBytecode,
  signingWallet
).attach(uniswapFactoryAddress);
const erc20Factory = new ethers.ContractFactory(
  erc20Abi,
  erc20Bytecode,
  signingWallet
);
const pairFactory = new ethers.ContractFactory(
  pairAbi,
  pairBytecode,
  signingWallet
);
const uniswap = new ethers.ContractFactory(
  uniswapV2RouterAbi,
  uniswapBytecode,
  signingWallet
).attach(uniswapAddress);
const sushiswap = new ethers.ContractFactory(
  uniswapV2RouterAbi,
  uniswapBytecode,
  signingWallet
).attach(sushiswapAddress);
const shibaswap = new ethers.ContractFactory(
  uniswapV2RouterAbi,
  uniswapBytecode,
  signingWallet
).attach(shibaswapAddress);
let flashbotsProvider = null;

// Decode uniswap universal router transactions
const decodeUniversalRouterSwap = (input) => {
  const abiCoder = new ethers.utils.AbiCoder();

  //   0000000000000000000000000000000000000000000000000000000000000002
  //   00000000000000000000000000000000000000000000000003782dace9d90000
  //   0000000000000000000000000000000000000000000000000258ec89a2bba93f
  //   00000000000000000000000000000000000000000000000000000000000000a0
  //   0000000000000000000000000000000000000000000000000000000000000000
  //   0000000000000000000000000000000000000000000000000000000000000002
  //   000000000000000000000000b4fbf271143f4fbf7b91a5ded31805e42b2208d6
  //   000000000000000000000000178e141a0e3b34152f73ff610437a7bf9b83267a

  const decodedParameters = abiCoder.decode(
    ["address", "uint256", "uint256", "bytes", "bool"],
    input
  );
  const breakdown = input.substring(2).match(/.{1,64}/g);

  let path = [];
  let hasTwoPath = true;
  if (breakdown.length <= 9) {
    const pathOne = "0x" + breakdown[breakdown.length - 2].substring(24);
    const pathTwo = "0x" + breakdown[breakdown.length - 1].substring(24);
    path = [pathOne, pathTwo];
  } else {
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
  let inputPosition = decoded.args.inputs[swapPositionInCommands];
  decodedSwap = decodeUniversalRouterSwap(inputPosition);
  // we only need the transactions to swap ETH for tokens
  if (decodedSwap.recipient === 2) return false;
  if (decodedSwap.path[0].toLowerCase() != wethAddress.toLowerCase())
    return false;

  return {
    transaction,
    amountIn: transaction.value,
    minAmountOut: decodedSwap.minAmountOut,
    tokenToCapture: decodedSwap.path[1],
  };
};

const processTransaction = async (tx) => {
  const checksPassed = await initialChecks(tx);
  if (!checksPassed) return;
  const { transaction, amountIn, minAmountOut, tokenToCapture } = checksPassed;
  // set attacker eth amount in
  var attackerEthAmountIn = amountIn;

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

  let reserveA;
  let reserveB;
  if (wethAddress < tokenToCapture) {
    reserveA = reserves._reserve0;
    reserveB = reserves._reserve1;
  } else {
    reserveA = reserves._reserve1;
    reserveB = reserves._reserve0;
  }

  // Buy using your ETH amount and calculate token amount out
  const attackerTokenAmountOut = getAmountOut(
    attackerEthAmountIn,
    reserveA,
    reserveB
  );

  const updatedReserveA = reserveA.add(attackerEthAmountIn);
  const updatedReserveB = reserveB.sub(
    attackerTokenAmountOut.mul(997).div(1000)
  );
  const victimAmountOut = getAmountOut(
    amountIn,
    updatedReserveA,
    updatedReserveB
  );
  if (victimAmountOut.lt(minAmountOut)) {
    // console.log("Victim would get less than the minimum amount out.");
    return;
  }

  const updatedReserveA2 = updatedReserveA.add(amountIn);
  const updatedReserveB2 = updatedReserveB.sub(
    victimAmountOut.mul(997).div(1000)
  );

  const attackerEthAmountOut = getAmountOut(
    attackerTokenAmountOut,
    updatedReserveB2,
    updatedReserveA2
  );

  if (attackerEthAmountOut.lt(attackerEthAmountIn)) {
    // console.log("The attacker would get less ETH out than in without accounting for gas fee.");
    return;
  }

  // Calculate reasonable gas fee
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  const nextBaseFee = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
    block.baseFeePerGas,
    1
  );

  const attackerMaxPriorityFeePerGas = transaction.maxPriorityFeePerGas
    ? transaction.maxPriorityFeePerGas.add(bribeToMiners)
    : bribeToMiners;
  const attackerMaxFeePerGas = nextBaseFee.add(attackerMaxPriorityFeePerGas);
  var type = 2;
  if (transaction.type === 0 || !transaction.type) {
    type = 0;
  }
  var extraInfo = { gasLimit: 300000 };
  if (type === 2) {
    extraInfo.maxFeePerGas = attackerMaxFeePerGas;
    extraInfo.maxPriorityFeePerGas = attackerMaxPriorityFeePerGas;
    extraInfo.type = 2;
  } else {
    extraInfo.gasPrice = attackerMaxFeePerGas;
    extraInfo.type = 0;
  }
  // Prepare first transaction
  const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
  let frontRunTransaction = {
    signer: signingWallet,
    transaction: await uniswap.populateTransaction.swapExactETHForTokens(
      attackerTokenAmountOut,
      [wethAddress, tokenToCapture],
      signingWallet.address,
      deadline,
      {
        value: attackerEthAmountIn,
        ...extraInfo,
      }
    ),
  };

  frontRunTransaction.transaction = {
    ...frontRunTransaction.transaction,
    chainId,
  };

  // Prepare victim transaction
  let victimTransactionWithChainId = {
    ...transaction,
    chainId,
  };

  let signedVictimTransaction;
  try {
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
  } catch (error) {
    return;
  }

  // Prepare approve transaction
  const erc20 = erc20Factory.attach(tokenToCapture);
  let approveTransaction = {
    signer: signingWallet,
    transaction: await erc20.populateTransaction.approve(
      uniswap.address,
      attackerTokenAmountOut,
      {
        value: "0",
        ...extraInfo,
      }
    ),
  };

  approveTransaction.transaction = {
    ...approveTransaction.transaction,
    chainId,
  };

  // Prepare the last selling back transaction
  let lastTransaction = {
    signer: signingWallet,
    transaction: await uniswap.populateTransaction.swapExactTokensForETH(
      attackerTokenAmountOut,
      attackerEthAmountOut,
      [tokenToCapture, wethAddress],
      signingWallet.address,
      deadline,
      {
        value: "0",
        ...extraInfo,
      }
    ),
  };

  lastTransaction.transaction = {
    ...lastTransaction.transaction,
    chainId,
  };

  // Send transaction bundle with flashbots
  const transactionBundle = [
    frontRunTransaction,
    signedVictimTransaction,
    approveTransaction,
    lastTransaction,
  ];

  const signedTransactions = await flashbotsProvider.signBundle(
    transactionBundle
  );
  console.log("Simulating...");
  try {
    const simulation = await flashbotsProvider.simulate(
      signedTransactions,
      blockNumber + 1
    );
    if (simulation.firstRevert) {
      console.log("Simulation error:", simulation.firstRevert.error);
      return;
    } else {
      if (simulation.error) {
        console.log("Simulation error:", simulation.error.message);
        return;
      }
      console.log("Simulation Success");
      const totalGasFees = attackerMaxFeePerGas.mul(
        simulation.results[0].gasUsed +
          simulation.results[2].gasUsed +
          simulation.results[3].gasUsed
      );
      if (attackerEthAmountIn.add(totalGasFees).gte(attackerEthAmountOut)) {
        console.log("The attacker would get less ETH out than in");
        return;
      } else {
        console.log("The attacker would get profit");
        console.log(
          "Attacker ETH in :",
          ethers.utils.formatEther(attackerEthAmountIn)
        );
        console.log(
          "Attacker gas    :",
          ethers.utils.formatEther(totalGasFees)
        );
        console.log(
          "Attacker ETH out:",
          ethers.utils.formatEther(attackerEthAmountOut)
        );
      }
    }

    let bundleSubmission;

    flashbotsProvider
      .sendRawBundle(signedTransactions, blockNumber + 1)
      .then((_bundleSubmission) => {
        bundleSubmission = _bundleSubmission;
        console.log("Bundle submitted", bundleSubmission.bundleHash);
        return bundleSubmission.wait();
      })
      .then(async (waitResponse) => {
        console.log("Wait response", FlashbotsBundleResolution[waitResponse]);
        if (waitResponse == FlashbotsBundleResolution.BundleIncluded) {
          console.log("-------------------------------------------");
          console.log("-------------------------------------------");
          console.log("----------- Bundle Included ---------------");
          console.log("-------------------------------------------");
          console.log("-------------------------------------------");
        } else if (
          waitResponse == FlashbotsBundleResolution.AccountNonceTooHigh
        ) {
          console.log("The victim transaction has been confirmed already");
        } else {
          console.log("Bundle hash", bundleSubmission.bundleHash);
          // console.log({
          //   bundleStats: await flashbotsProvider.getBundleStats(
          //     bundleSubmission.bundleHash,
          //     blockNumber + 1
          //   ),
          //   userStats: await flashbotsProvider.getUserStats(),
          // });
        }
      });
  } catch (error) {
    return;
  }
};
const start = async () => {
  // if (isMainThread) {
  console.log("Attacker address:", signingWallet.address);
  console.log("Listening on transaction for the chain id", chainId);
  // const cpuCount = os.cpus().length;
  // for (let i = 0; i < 2; i++) {
  //   new Worker(__filename);
  // }
  // } else {

  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    signingWallet,
    flashbotsUrl
  );
  wsProvider.on("pending", async (tx) => {
    await processTransaction(tx);
  });
  // }
};

start();
