// 0x0c53898C3710DA458b1c539e664D16EB33572fEB
task("deposit", "Deposit ETH to mev contract")
  .addParam("mev", "The mev contract address")
  .addParam("amount", "Deposit amount in ETH")
  .setAction(async (_taskArgs, hre) => {
    const signer = hre.ethers.provider.getSigner(0);
    const abi = require("../../bot/build/mev.abi.json");
    const mev = new ethers.Contract(_taskArgs.mev, abi, signer);
    const tx = await mev.connect(signer).depositWETH({value: ethers.utils.parseEther(_taskArgs.amount)});
    await tx.wait();
    console.log("Deposit amount: ", _taskArgs.amount);
});

task("withdraw", "withdraw WETH from mev contract")
  .addParam("mev", "The mev contract address")
  .addParam("amount", "Deposit amount in ETH")
  .setAction(async (_taskArgs, hre) => {
    const signer = hre.ethers.provider.getSigner(0);
    const abi = require("../../bot/build/mev.abi.json");
    const mev = new ethers.Contract(_taskArgs.mev, abi, signer);
    const tx = await mev.connect(signer).withdrawWETH(ethers.utils.parseEther(_taskArgs.amount));
    await tx.wait();
    console.log("Withdraw amount: ", _taskArgs.amount);
});