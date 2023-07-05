require("@nomicfoundation/hardhat-toolbox");
require("huff-deployer");
require("dotenv").config();
require("./tasks/deploy.js");
require("./tasks/deposit.js");

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
      accounts: [process.env.PRIVATE_KEY],
      url: process.env.GOERLI_HTTP_PROVIDER_URL,
    }
  },
  gasReporter: {
    enabled: /* (process.env.REPORT_GAS) ? true :  */false,
    token: 'ETH',
    currency: 'ETH',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
};
