task("deploy", "Deploy the MEV contract", async (_taskArgs, hre) => {
  const signer = hre.ethers.provider.getSigner(0);
  // const wethAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // mainnet
  const wethAddr = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"; // goerli
  console.log("Deployer address:", await signer.getAddress());
  const abi = require("../build/mev.abi.json");
  const bytecode = require("../build/mev.bytecode.json");
  const MEV = await ethers.getContractFactory(abi, bytecode);
  const mev = await MEV.deploy(wethAddr);
  await mev.deployed();
  console.log("MEV address:", mev.address);
});

task("transferownership", "Transfers ownership to another address")
  .addParam("mev", "The mev contract address")
  .addParam("owner", "New owner address of the smart contract")
  .setAction(async (_taskArgs, hre) => {
    const signer = hre.ethers.provider.getSigner(0);
    const mevArtifact = artifacts.readArtifactSync("MEV");
    const mev = new ethers.Contract(_taskArgs.mev, mevArtifact.abi, signer);
    const tx = await mev.connect(signer).transferOwnership(_taskArgs.owner);
    await tx.wait();
    console.log("New owner of the MEV contract: ", _taskArgs.owner);
  });
