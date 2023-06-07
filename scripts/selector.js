// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
import hre from "hardhat";

const selector = hre.ethers.utils
  .id("swapExactTokensForTokens(uint256,uint256,address,address,bool,uint256)")
  .substring(0, 10);

console.log("Selector:", selector);
