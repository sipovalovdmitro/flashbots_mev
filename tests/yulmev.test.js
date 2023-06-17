const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { erc20Abi } = require("../helpers/abis/abi.js");
const { ethers } = require("hardhat");

describe("For the Pure Yul MEV contract", function () {
  const wethAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // mainnet
  async function deployMEVFixture() {
    const signer = await ethers.getImpersonatedSigner(
      "0x88C26Ad4621349ff877A99C8Aa2c31509Fb80b8C"
    );
    const abi = require("../build/mev.abi.json");
    const bytecode = require("../build/mev.bytecode.json");
    const MEV = await hre.ethers.getContractFactory(abi, bytecode);
    // const MEV = await hre.ethers.getContractFactory("MEV");
    // const mev = MEV.attach("0xe33cdF1aE9218D6c86b99f5278A41266bd87E9B4");
    const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const mev = await MEV.deploy(weth, signer.address);
    await mev.deployed();
    // console.log(mev.address);
    return { mev, signer };
  }
  describe("The deployment", function () {
    it("Should deploy correctly", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);
      expect(mev.address).is.properAddress;
      expect(mev.address).is.not.null;
    });
    it("Should run owner() wethAddr()", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);
      expect(await mev.owner()).to.equal(signer.address);
      expect(await mev.wethAddr()).to.equal(wethAddr);
    });
    it("Should run transferOwnership(address)", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);
      await expect(
        mev
          .connect(signer)
          .transferOwnership("0xdB4e4Cd74E9BfDf78E4dA8d2953bb624FBeBe6b3")
      ).to.not.be.reverted;
      expect(await mev.owner()).to.equal(
        "0xdB4e4Cd74E9BfDf78E4dA8d2953bb624FBeBe6b3"
      );
    });
    it("Should run depositWETH() withdrawWETH(uint amount)", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);

      const wethContract = new ethers.Contract(wethAddr, erc20Abi, signer);
      const wethBalanceBefore = await wethContract.balanceOf(mev.address);
      // console.log("WETH balance before deposit:", wethBalanceBefore);

      await expect(
        mev.connect(signer).depositWETH({ value: ethers.utils.parseEther("1") })
      ).to.not.be.reverted;
      const wethBalanceAfter = await wethContract.balanceOf(mev.address);
      // console.log("WETH balance after deposit:", wethBalanceAfter);
      await expect(
        mev.connect(signer).withdrawWETH(ethers.utils.parseEther("1"))
      ).to.not.be.reverted;
      // const tx = await mev.connect(signer).withdrawWETH(ethers.utils.parseEther("0.5"));
      // const receipt = await tx.wait();
      // console.log(receipt.events);
      const wethBalanceAfterWithdraw = await wethContract.balanceOf(
        mev.address
      );
      // console.log(wethBalanceAfterWithdraw);
      // console.log("WETH balance after withdraw:", wethBalanceAfterWithdraw);
    });
    it("Should run withdrawETH()", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);
      tx = {
        to: mev.address,
        value: ethers.utils.parseEther("1", "ether"),
      };
      const transaction = await signer.sendTransaction(tx);
      var balance = await ethers.provider.getBalance(mev.address);
      console.log(
        "Balance before withdraw:",
        ethers.utils.formatEther(balance)
      );
      await expect(mev.connect(signer).withdrawETH()).to.not.be.reverted;
      balance = await ethers.provider.getBalance(mev.address);
      console.log("Balance after withdraw:", ethers.utils.formatEther(balance));
    });
    it("Should be successful to swap", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);
      const tokenToCapture = "0x7e2454c6aa75e6470a941f1c7d9920352f3a78c9";
      const pair = "0x395ee78ef8494f332f0b189858a23f95feaec1fb";
      const amountIn = ethers.BigNumber.from("0x7a2e72925ebf0d");
      const amountOutMin = ethers.BigNumber.from("0x2f9ca7e656e33d");
      const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
      await expect(
        mev.connect(signer).depositWETH({ value: ethers.utils.parseEther("1") })
      ).to.not.be.reverted;
      const tokenContract = new ethers.Contract(
        tokenToCapture,
        erc20Abi,
        signer
      );
      const tokenBalanceBeforeSwap = await tokenContract.balanceOf(mev.address);
      console.log(
        "Token balance before swap:",
        ethers.utils.formatEther(tokenBalanceBeforeSwap)
      );
      await expect(
        mev
          .connect(signer)
          .swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            pair,
            tokenToCapture,
            true,
            deadline
          )
      ).to.not.be.reverted;
      const tokenBalanceAfterSwap = await tokenContract.balanceOf(mev.address);
      console.log(
        "Token balance after swap:",
        ethers.utils.formatEther(tokenBalanceAfterSwap)
      );
      await expect(
        mev
          .connect(signer)
          .swapExactTokensForTokens(
            amountOutMin,
            0,
            pair,
            tokenToCapture,
            false,
            deadline
          )
      ).to.not.be.reverted;
      // const tx = await mev
      //   .connect(signer)
      //   .swapExactTokensForTokens(
      //     amountOutMin,
      //     0,
      //     pair,
      //     tokenToCapture,
      //     false,
      //     deadline
      //   );
      // const receipt = await tx.wait()
      // console.log(receipt.events);
    });
  });
});
