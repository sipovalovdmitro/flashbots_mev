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
// 0x0c53898C3710DA458b1c539e664D16EB33572fEB

task("deploysol", "Deploy solidity MEV contract", async (_taskArgs, hre) => {
  const signer = hre.ethers.provider.getSigner(0);
  console.log("Deployer address:", await signer.getAddress());
  const MEV = await ethers.getContractFactory("MEV");
  const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const mev = await MEV.deploy(weth, signer.address);
  await mev.deployed();
  console.log("MEV address:", mev.address);
});


task("transferownership", "Transfers ownership to another address")
  .addParam("mev", "The mev contract address")
  .addParam("owner", "New owner address of the smart contract")
  .setAction(async (_taskArgs, hre) => {
    const signer = hre.ethers.provider.getSigner(0);
    const abi = require("../../bot/build/mev.abi.json");
    const mev = new ethers.Contract(_taskArgs.mev, abi, signer);
    const tx = await mev.connect(signer).transferOwnership(_taskArgs.owner);
    await tx.wait();
    console.log("New owner of the MEV contract: ", _taskArgs.owner);
  });
