const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { erc20Abi } = require("../../bot/helpers/abis/abi.js");
const { ethers } = require("hardhat");
const { getAmountOut } = require("../../bot/helpers/utils/amount.js");
const { huffDeployer } = require("hardhat");

const v2_output0 = 0x06;
const v2_input0 = 0x0B;
const v2_output1 = 0x10;
const v2_input1 = 0x15;
const seppuku = 0x1a;
const recoverEth = 0x1F;
const recoverWeth = 0x24;


describe("For the Huff contract", function () {
    const wethAddr = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // mainnet
    async function deployMEVFixture() {
        const signer = await ethers.getImpersonatedSigner(
            "0x88C26Ad4621349ff877A99C8Aa2c31509Fb80b8C"
        );
        const mev = await huffDeployer.deploy("mev", false);
        console.log(mev.address);
        return { mev, signer };
    }
    describe("The deployment", function () {
        it("Should deploy correctly", async function () {
            const { mev, signer } = await loadFixture(deployMEVFixture);
            expect(mev.address).is.properAddress;
            expect(mev.address).is.not.null;
        });
        
        it("Should send and recover WETH successfully", async function () {
            const { mev, signer } = await loadFixture(deployMEVFixture);

            const wethContract = new ethers.Contract(wethAddr, erc20Abi, signer);
            const wethBalanceBefore = await wethContract.balanceOf(mev.address);

            const wethAmountToDeposit = ethers.utils.parseEther('0.5');
            await expect(wethContract.deposit({value: wethAmountToDeposit})).to.not.be.reverted;
            await expect(wethContract.transfer(mev.address, wethAmountToDeposit)).to.not.be.reverted;
            const wethBalanceAfter = await wethContract.balanceOf(mev.address);
            expect(wethBalanceAfter.sub(wethBalanceBefore)).to.equal(wethAmountToDeposit);
            console.log("WETH Balance after deposit", ethers.utils.formatEther(wethBalanceAfter));

            const payload = ethers.utils.solidityPack(["uint8", "uint256"], [recoverWeth, wethAmountToDeposit]);
            const tx = {
                to: mev.address,
                data: payload,
            }
            const transaction = await signer.sendTransaction(tx);

            // console.log(transaction);
            const result = await transaction.wait();
            // console.log(result);
            const wethBalanceAfterRecoverWETH = await wethContract.balanceOf(mev.address);
            console.log("WETH Balance after recover", ethers.utils.formatEther(wethBalanceAfterRecoverWETH));
        });
        
        it("Should send and recover ETH successfully", async function () {
            const { mev, signer } = await loadFixture(deployMEVFixture);
            const ethAmount = ethers.utils.parseEther('0.5');
            const tx = {
                to: mev.address,
                value: ethAmount
            }
            await signer.sendTransaction(tx);
            const ethBalanceAfter = await ethers.provider.getBalance(mev.address);
            console.log(ethBalanceAfter);
            expect(ethBalanceAfter).to.equal(ethAmount);
        });
    });
});
