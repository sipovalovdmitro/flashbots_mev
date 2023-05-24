import { Wallet, BigNumber, ethers, providers } from "ethers";
const {FlashbotsBundleProvider, FlashbotsBundleResolution} = require('@flashbots/ethers-provider-bundle');
require("dotenv").config();
const privatekey = process.env.PRIVATE_KEY;

// Setup the provider for sepolia or mainnet
const provider = new providers.JsonRpcProvider('https://sepolia.infura.io/v3/1318c38c0a814d1fb072fc3d4b0002ce');

// Create a unique flashbots id
const authSigner = new Wallet(privatekey, provider);

