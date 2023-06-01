import { ethers } from "ethers";

function getPair(factory, tokenA, tokenB) {
  const _hexadem =
    "96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f";
  const [token0, token1] =
    tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];

  let abiEncoded1 = ethers.utils.defaultAbiCoder.encode(
    ["address", "address"],
    [token0, token1]
  );
  abiEncoded1 = abiEncoded1.split("0".repeat(24)).join("");
  const salt = ethers.utils.solidityKeccak256(["bytes"], [abiEncoded1]);
  let abiEncoded2 = ethers.utils.defaultAbiCoder.encode(
    ["address", "bytes32"],
    [factory, salt]
  );
  abiEncoded2 = abiEncoded2.split("0".repeat(24)).join("").substring(2);
  const pair =
    "0x" +
    ethers.utils
      .solidityKeccak256(["bytes"], [`0xff${abiEncoded2}${_hexadem}`])
      .substring(26);

  return pair;
}


export { getPair };
