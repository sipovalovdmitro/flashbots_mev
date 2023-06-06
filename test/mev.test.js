import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs.js";
import { expect } from "chai";
import { erc20Abi } from "../helpers/abis/abi.js";

describe("MEV", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployMEVFixture() {
    // Contracts are deployed using the first signer/account by default
    const signer = await ethers.getImpersonatedSigner(
      "0x88C26Ad4621349ff877A99C8Aa2c31509Fb80b8C"
    );
    const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const MEV = await ethers.getContractFactory("MEV");
    const mev = await MEV.connect(signer).deploy(weth);
    await mev.deployed();

    return { mev, signer, weth };
  }

  describe("Swap", function () {
    it("Should be successful to swap", async function () {
      const { mev, signer, weth } = await deployMEVFixture();
      expect(await mev.owner()).to.equal(signer.address);
      const tokenToCapture = "0x14476d371bbcf528f37ad867f24588f1b49dd980";
      const pair = "0x1b4e609b1697b8849aa23698af5c44b13bb1b84b";
      const amountIn = ethers.utils.parseEther("1");
      const deadline = Math.floor(Date.now() / 1000) + 60 * 60;

      await expect(
        mev.connect(signer).depositWETH({ value: ethers.utils.parseEther("1") })
      ).to.not.be.reverted;
      const wethContract = new ethers.Contract(weth, erc20Abi, signer);
      const tokenContract = new ethers.Contract(tokenToCapture, erc20Abi, signer);
      const wethBalanceBeforeSwap = await wethContract.balanceOf(mev.address);
      const tokenBalanceBeforeSwap = await tokenContract.balanceOf(mev.address);
      console.log(
        "WETH balance before swap:",
        ethers.utils.formatEther(wethBalanceBeforeSwap)
      );
      console.log(
        "Token balance before swap:",
        ethers.utils.formatEther(tokenBalanceBeforeSwap)
      );
      
      // await expect(
        const tx =await mev
          .connect(signer)
          .swapExactTokensForTokens(
            amountIn,
            0,
            deadline,
            pair,
            tokenToCapture,
            true
          )
      // ).to.not.be.reverted;
      const receipt = await tx.wait();
      console.log(receipt.events);

      const wethBalanceAfterSwap = await wethContract.balanceOf(mev.address);
      const tokenBalanceAfterSwap = await tokenContract.balanceOf(mev.address);
      console.log(
        "WETH balance after swap:",
        ethers.utils.formatEther(wethBalanceAfterSwap)
      );
      console.log(
        "Token balance after swap:",
        ethers.utils.formatEther(tokenBalanceAfterSwap)
      );
    });
  });
});
