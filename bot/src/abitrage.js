import { Wallet, ethers } from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution
} from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
dotenv.config();

import {
    uniswapV2RouterAbi,
    uniswapFactoryAbi,
    pairAbi,
    erc20Abi,
    pancakeRouterAbi,
  } from "../../helpers/abis/abi.js";