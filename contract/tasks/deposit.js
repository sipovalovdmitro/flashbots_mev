// 0x62f7F4b476ae0781344e4c1A950C05895f4Ea93D
task("depositweth", "Deposit ETH to mev contract")
  .addParam("mev", "The mev contract address")
  .addParam("amount", "Deposit amount in ETH")
  .setAction(async (_taskArgs, hre) => {
    const signer = hre.ethers.provider.getSigner(0);
    console.log("Deposit amount: ", _taskArgs.amount);
    const { DEPOSIT_WETH_LABEL } = require("../../bot/helpers/constant");
    const payload = ethers.utils.solidityPack(["uint8"], [DEPOSIT_WETH_LABEL]);
    const tx = {
      to: _taskArgs.mev,
      from: signer.address,
      value: ethers.utils.parseEther(_taskArgs.amount),
      data: payload
    }
    const transaction = await signer.sendTransaction(tx);
    await transaction.wait();
});

task("recoverweth", "withdraw WETH from mev contract")
  .addParam("mev", "The mev contract address")
  .addParam("amount", "Recover amount in ETH")
  .setAction(async (_taskArgs, hre) => {
    const signer = hre.ethers.provider.getSigner(0);
    console.log("Withdraw amount: ", _taskArgs.amount);
    const { RECOVER_WETH_LABEL } = require("../../bot/helpers/constant");
    const payload = ethers.utils.solidityPack(["uint8", "uint256"], [RECOVER_WETH_LABEL, ethers.utils.parseEther(_taskArgs.amount)]);
    const tx = {
      to: _taskArgs.mev,
      from: signer.address,
      data: payload
    }
    const transaction = await signer.sendTransaction(tx);
    await transaction.wait();
});
