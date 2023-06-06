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
        runs: 999999
      }
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://nd-695-422-976.p2pify.com/bf964bebc0149d0ab3f3def03f13a16d",
      }
    },
    mainnet: {
      accounts: {
        count: 10,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      url: "https://nd-695-422-976.p2pify.com/bf964bebc0149d0ab3f3def03f13a16d",
      // gasPrice: 53000000000
    }
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false,
    token: 'ETH',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
};
