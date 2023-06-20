const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { erc20Abi } = require("../../bot/helpers/abis/abi.js");
const { ethers } = require("hardhat");
const { getAmountOut } = require("../../bot/helpers/utils/amount.js");

describe("For the Pure Yul MEV contract", function () {
  const wethAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // mainnet
  async function deployMEVFixture() {
    const signer = await ethers.getImpersonatedSigner(
      "0x112200EaA6d57120c86B8b51a8b6049d56B82211"
    );
    const abi = require("../../bot/build/mev.abi.json");
    const bytecode = require("../../bot/build/mev.bytecode.json");
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
    it("Should be successful to swap when weth is token 1", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);
      const tokenToCapture = "0x7e2454c6aa75e6470a941f1c7d9920352f3a78c9";
      const pair = "0x395ee78ef8494f332f0b189858a23f95feaec1fb";
      const {
        pairAbi,
        pairBytecode,
      } = require("../../bot/helpers/abis/abi.js");
      const pairContract = new ethers.ContractFactory(
        pairAbi,
        pairBytecode,
        signer
      ).attach(pair);
      const reserves = await pairContract.getReserves();
      let reserveWETH = reserves._reserve1;
      let reserveToken = reserves._reserve0;
      const amountIn = ethers.BigNumber.from("34391016775532301");
      const { getAmountOut } = require("../../bot/helpers/utils/amount.js")
      const tokenAmountOut = getAmountOut(amountIn, reserveWETH, reserveToken);
      await expect(
        mev.connect(signer).depositWETH({ value: ethers.utils.parseEther("4") })
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
          .v2WethInput1(
            amountIn,
            tokenAmountOut,
            pair
          )
      ).to.not.be.reverted;
      const tokenBalanceAfterSwap = await tokenContract.balanceOf(mev.address);
      console.log(
        "Token balance after swap:",
        ethers.utils.formatEther(tokenBalanceAfterSwap)
      );
      reserveWETH = reserveWETH.add(amountIn);
      reserveToken = reserveToken.sub(
        tokenAmountOut
      );
      const amountOutBack = getAmountOut(tokenAmountOut, reserveToken, reserveWETH);
      await expect(
        mev
          .connect(signer)
          .v2WethOutput1(
            tokenAmountOut,
            amountOutBack,
            pair,
            tokenToCapture
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
    it("Should be successful to swap when weth is token 0", async function () {
      const { mev, signer } = await loadFixture(deployMEVFixture);
      const tokenToCapture = "0xf3b9569f82b18aef890de263b84189bd33ebe452";
      const pair = "0x48d20b3e529fb3dd7d91293f80638df582ab2daa";
      const {
        pairAbi,
        pairBytecode,
      } = require("../../bot/helpers/abis/abi.js");
      const pairContract = new ethers.ContractFactory(
        pairAbi,
        pairBytecode,
        signer
      ).attach(pair);
      const reserves = await pairContract.getReserves();
      let reserveWETH = reserves._reserve0;
      let reserveToken = reserves._reserve1;
      const amountIn = ethers.utils.parseEther("1");
      const { getAmountOut } = require("../../bot/helpers/utils/amount.js")
      const tokenAmountOut = getAmountOut(amountIn, reserveWETH, reserveToken);
      await expect(
        mev.connect(signer).depositWETH({ value: ethers.utils.parseEther("4") })
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
          .v2WethInput0(
            amountIn,
            tokenAmountOut,
            pair
          )
      ).to.not.be.reverted;
      const tokenBalanceAfterSwap = await tokenContract.balanceOf(mev.address);
      console.log(
        "Token balance after swap:",
        ethers.utils.formatEther(tokenBalanceAfterSwap)
      );
      reserveWETH = reserveWETH.add(amountIn);
      reserveToken = reserveToken.sub(
        tokenAmountOut
      );
      const amountOutBack = getAmountOut(tokenAmountOut, reserveToken, reserveWETH);
      await expect(
        mev
          .connect(signer)
          .v2WethOutput0(
            tokenAmountOut,
            amountOutBack,
            pair,
            tokenToCapture
          )
      ).to.not.be.reverted;

    });
  });
});
