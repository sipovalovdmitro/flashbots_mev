task("deployyul", "Deploy pure yul MEV contract", async (_taskArgs, hre) => {
  const signer = hre.ethers.provider.getSigner(0);
  console.log("Deployer address:", await signer.getAddress());
  const abi = require("../build/mev.abi.json");
  const bytecode = require("../build/mev.bytecode.json");
  const MEV = await ethers.getContractFactory(abi, bytecode);
  const mev = await MEV.deploy();
  await mev.deployed();
  console.log("MEV address:", mev.address);
});
// 0xe33cdF1aE9218D6c86b99f5278A41266bd87E9B4

task("deploysol", "Deploy solidity MEV contract", async (_taskArgs, hre) => {
  const signer = hre.ethers.provider.getSigner(0);
  console.log("Deployer address:", await signer.getAddress());
  const MEV = await ethers.getContractFactory("MEV");
  const mev = await MEV.deploy();
  await mev.deployed();
  console.log("MEV address:", mev.address);
});
// 0xC2D9FAFb448D883cC1327bf6799e6A1A20CB3Da8


task("transferownership", "Transfers ownership to another address")
  .addParam("mev", "The mev contract address")
  .addParam("owner", "New owner address of the smart contract")
  .setAction(async (_taskArgs, hre) => {
    const signer = hre.ethers.provider.getSigner(0);
    const abi = require("../build/mev.abi.json");
    const mev = new ethers.Contract(_taskArgs.mev, abi, signer);
    const tx = await mev.connect(signer).transferOwnership(_taskArgs.owner);
    await tx.wait();
    console.log("New owner of the MEV contract: ", _taskArgs.owner);
  });
