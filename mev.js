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

const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);
const wsProvider = new ethers.providers.WebSocketProvider(wsProviderUrl);

const signingWallet = new Wallet(privateKey).connect(provider);
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

const initialChecks = async (tx) => {
  let transaction = null;
  let decoded = null;
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
  console.log("decoded", decoded);
  return true;
};

const processTransaction = async (tx) => {
  const checksPassed = await initialChecks(tx);
  console.log("checksPassed", checksPassed);
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
