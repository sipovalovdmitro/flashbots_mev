import { Wallet, ethers } from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution
} from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
dotenv.config();
const privatekey = process.env.PRIVATE_KEY;

// Setup the provider for goerli or mainnet
const provider = new ethers.providers.JsonRpcProvider(
  "https://goerli.infura.io/v3/1318c38c0a814d1fb072fc3d4b0002ce"
);

// Create a unique flashbots id
const authSigner = new Wallet(privatekey, provider);

// Create the flashbots provider inside a start function
const start = async () => {
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    "https://relay-goerli.flashbots.net"
  );
  // Setup the required gas and block variables
  const GWEI = ethers.utils.parseUnits("1", "gwei");
  const LEGACY_GAS_PRICE = GWEI.mul(13);
  const PRIORITY_FEE = GWEI.mul(100);
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  const maxBaseFeeInFutureBlock =
    FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(block.baseFeePerGas, 6);
  const amountInEther = "0.001";

  // Create the signed transfer transactions using both types
  const signedTransactions = await flashbotsProvider.signBundle([
    {
      signer: authSigner,
      transaction: {
        to: "0x501E809C8C8d268E136B6975b331EA398e07d35e",
        type: 2,
        maxFeePerGas: PRIORITY_FEE.add(maxBaseFeeInFutureBlock),
        maxPriorityFeePerGas: PRIORITY_FEE,
        data: "0x",
        chainId: 5,
        value: ethers.utils.parseEther(amountInEther)
        // gasLimit: 300000,
      }
    },
    // we need this second tx because flashbots only accept bundles that use at least 42000 gas.
    {
      signer: authSigner,
      transaction: {
        to: "0x501E809C8C8d268E136B6975b331EA398e07d35e",
        gasPrice: LEGACY_GAS_PRICE,
        data: "0x",
        chainId: 5,
        value: ethers.utils.parseEther(amountInEther)
      }
    }
  ]);

  // Run a flashbots simulation to make sure it works
  console.log(new Date());
  console.log("Starting to run the simulation...");
  const simulation = await flashbotsProvider.simulate(
    signedTransactions,
    blockNumber + 1
  );
  console.log(new Date());
  // Check the result of the simulation
  if (simulation.firstRevert) {
    console.log(`Simulation error: ${simulation.firstRevert.error}`);
  } else {
    console.log(`Simulation Success: ${blockNumber}`);
  }

  // Try to send bundles ten times to guarantee inclusion in a flashbots generated block
  for (var i = 1; i <= 10; i++) {
    const bundleSubmission = await flashbotsProvider.sendRawBundle(
      signedTransactions,
      blockNumber + i
    );
    console.log("bundle submitted, waiting", bundleSubmission.bundleHash);
    const waitResponse = await bundleSubmission.wait();
    console.log(`Wait response: ${FlashbotsBundleResolution[waitResponse]}`);
    if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
      console.log("Bundle included!");
      process.exit(0);
    } else {
      console.log({
        bundleStats: await flashbotsProvider.getBundleStatsV2(
          simulation.bundleHash,
          blockNumber + i
        ),
        userStats: await flashbotsProvider.getUserStatsV2()
      });
    }
  }
};

start();
