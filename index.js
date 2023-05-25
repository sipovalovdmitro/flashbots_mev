import { Wallet, BigNumber, ethers, providers } from "ethers";
const {FlashbotsBundleProvider, FlashbotsBundleResolution} = require('@flashbots/ethers-provider-bundle');
require("dotenv").config();
const privatekey = process.env.PRIVATE_KEY;

// Setup the provider for sepolia or mainnet
const provider = new providers.JsonRpcProvider('https://sepolia.infura.io/v3/1318c38c0a814d1fb072fc3d4b0002ce');

// Create a unique flashbots id
const authSigner = new Wallet(privatekey, provider);

// Create the flashbots provider inside a start function
const start = async()=>{
    const flashbotsProvider = FlashbotsBundleProvider.create(
        provider,
        authSigner,
        'https://relay-sepolia.flashbots.net'
    )
    // Setup the required gas and block variables
    const GWEI = ethers.utils.parseUnits("1", "gwei");
    const LEGACY_GAS_PRICE = GWEI.mul(12);
    const PRIORITY_FEE = GWEI.mul(100);
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(block.baseFeePerGas, 6);
    const amountInEther = '0.001';

    // Create the signed transfer transactions using both types
    const signedTransactions = (await flashbotsProvider).signBundle([
        {
            signer: authSigner,
            transaction: {
                to: '0x501E809C8C8d268E136B6975b331EA398e07d35e',
                type: 2,
                maxFeePerGas: PRIORITY_FEE.add(maxBaseFeeInFutureBlock),
                maxPriorityFeePerGas: PRIORITY_FEE,
                data: '0x',
                chainId: 11155111,
                value: ethers.utils.parseEther(amountInEther),
                // gasLimit: 300000,
            }
        },
        // we need this second tx because flashbots only accept bundles that use at least 42000 gas.
        {
            signer: authSigner,
            transaction: {
                to: '0x501E809C8C8d268E136B6975b331EA398e07d35e',
                type: 2,
                gasPrice: LEGACY_GAS_PRICE,
                data: '0x',
                chainId: 11155111,
                value: ethers.utils.parseEther(amountInEther),
            }
        }
    ])
}



start()