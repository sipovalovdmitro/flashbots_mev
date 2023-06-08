require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("./tasks/deploy.js");

/** @type import('hardhat/config').HardhatUserConfig */
const mnemonic = process.env.MNEMONIC;
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999
      }
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_HTTP_PROVIDER_URL,
      }
    },
    mainnet: {
      accounts: [process.env.PRIVATE_KEY],
      url: process.env.MAINNET_HTTP_PROVIDER_URL,
    },
    goerli: {
      accounts: {
        count: 2,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      url: process.env.GOERLI_HTTP_PROVIDER_URL,
    }
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false,
    token: 'ETH',
    currency: 'ETH',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
};
