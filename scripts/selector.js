// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
import hre from "hardhat";

const transferFromSelector = hre.ethers.utils
  .id("transferFrom(address,address,uint256)")
  .substring(0, 10);
const getReservesSelector = hre.ethers.utils
  .id("getReserves()")
  .substring(0, 10);
const swapSelector = hre.ethers.utils
  .id("swap(uint256,uint256,address,bytes)")
  .substring(0, 10);
console.log("transferFromSelector:", transferFromSelector);
console.log("getReservesSelector:", getReservesSelector);
console.log("swapSelector:", swapSelector);
