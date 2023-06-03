require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
const mnemonic = process.env.MNEMONIC;
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    mainnet: {
      accounts: {
        count: 10,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      url: "https://mainnet.infura.io/v3/1318c38c0a814d1fb072fc3d4b0002ce",
      // gasPrice: 53000000000
    },
    sepolia: {
      accounts: {
        count: 10,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      url: "https://sepolia.infura.io/v3/1318c38c0a814d1fb072fc3d4b0002ce",
    },
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false,
    token: 'ETH',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
};
