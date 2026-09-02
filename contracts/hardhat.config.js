require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env.local" });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 137,
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 56,
    },
    mainnet: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 1,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};
