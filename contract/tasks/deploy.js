task("deployyul", "Deploy pure yul MEV contract", async (_taskArgs, hre) => {
  const signer = hre.ethers.provider.getSigner(0);
  const owner = await signer.getAddress();
  console.log("Deployer address:", owner);
  const abi = require("../../bot/build/mev.abi.json");
  const bytecode = require("../../bot/build/mev.bytecode.json");
  const MEV = await ethers.getContractFactory(abi, bytecode);
  const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const mev = await MEV.deploy(weth, owner);
  await mev.deployed();
  console.log("MEV address:", mev.address);
});
// 0x62f7F4b476ae0781344e4c1A950C05895f4Ea93D


task("deployhuff", "Deploy Huff MEV contract", async (_taskArgs, hre) => {
  const signer = hre.ethers.provider.getSigner(0);
  console.log("Deployer address:", await signer.getAddress());
  const { huffDeployer } = require("hardhat");
  const mev = await huffDeployer.deploy("mev", false);
  console.log("MEV address:", mev.address);
});

