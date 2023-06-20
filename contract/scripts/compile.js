const path = require("path");
const fs = require("fs");
const solc = require("solc");

const outputPath = path.resolve(__dirname, "..", "..", "bot/build", "mev.bytecode.json");

const inputPath = path.resolve(__dirname, "..", "contracts", "mev.yul");

const source = fs.readFileSync(inputPath, "utf-8");

var input = {
    language: 'Yul',
    sources: {
        'mev.yul': {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ["evm.bytecode"]
            }
        }
    }
}

const compiledContract = solc.compile(JSON.stringify(input));
console.log(compiledContract)
const bytecode = JSON.parse(compiledContract).contracts["mev.yul"].MEV.evm.bytecode.object;

fs.writeFile(outputPath, JSON.stringify(bytecode), (err) => { })
