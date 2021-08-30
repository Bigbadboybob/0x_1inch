// const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider")
const mnemonic = require("./secrets.json").mnemonic;
require("dotenv").config()

module.exports = {
	// See <http://truffleframework.com/docs/advanced/configuration> to customize your Truffle configuration!
	// contracts_build_directory: path.join(__dirname, "client/src/contracts"),
	networks: {
	  development: {
	    host: "127.0.0.1",
	    port: 8545,
	    // gas: 20000000,
	    network_id: "*",
	    skipDryRun: true
	  },
	  ropsten: {
	    provider: () => new HDWalletProvider(mnemonic, `https://speedy-nodes-nyc.moralis.io/676a6c6eac64d9f866c4daca/eth/ropsten`),
	    network_id: 3,
	    gas: 5000000,
		gasPrice: 5000000000, // 5 Gwei
		skipDryRun: true
	  },
	  kovan: {
	    provider: () => new HDWalletProvider(mnemonic, `https://speedy-nodes-nyc.moralis.io/676a6c6eac64d9f866c4daca/eth/kovan`),
	    network_id: 42,
	    gas: 5000000,
		gasPrice: 5000000000, // 5 Gwei
		skipDryRun: true
	  },
	  mainnet: {
	    provider: () => new HDWalletProvider(mnemonic, `https://speedy-nodes-nyc.moralis.io/676a6c6eac64d9f866c4daca/eth/mainnet`),
	    network_id: 1,
	    gas: 5000000,
	    gasPrice: 24000000000 // 24 Gwei
	  }
	},
	compilers: {
		solc: {
			version: "^0.8.7",
		},
	},
}
