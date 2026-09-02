const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = network.config.chainId;

  console.log("====================================");
  console.log("EscrowVault v2 Deployment");
  console.log("====================================");
  console.log("Network:", network.name);
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Admin: deployer or env override
  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  console.log("\nDeployment params:");
  console.log("  Admin:", admin);
  console.log("  Fee Recipient:", feeRecipient);
  console.log("  Fee BPS: 30 (0.3%)");
  console.log("  Penalty BPS: 1000 (10%)");

  // Deploy
  const EscrowVault = await ethers.getContractFactory("EscrowVault");
  const vault = await EscrowVault.deploy(admin, feeRecipient, 30, 1000);

  console.log("\nDeploying EscrowVault...");
  const deployTx = vault.deploymentTransaction();
  console.log("  TX hash:", deployTx.hash);

  await vault.waitForDeployment();
  const address = await vault.getAddress();

  console.log("  Deployed to:", address);

  // Wait for confirmations on live networks
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for 2 confirmations...");
    await vault.deploymentTransaction().wait(2);
    console.log("  Confirmed!");
  }

  // Grant operational roles (admin gets both by default; env overrides add extra holders)
  const ARBITRATOR_ROLE = await vault.ARBITRATOR_ROLE();
  const PAUSER_ROLE = await vault.PAUSER_ROLE();
  if (admin.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("
Granting ARBITRATOR_ROLE + PAUSER_ROLE to admin", admin);
    await (await vault.grantRole(ARBITRATOR_ROLE, admin)).wait();
    await (await vault.grantRole(PAUSER_ROLE, admin)).wait();
    for (const [envKey, role, label] of [
      ["ARBITRATOR_ADDRESS", ARBITRATOR_ROLE, "ARBITRATOR_ROLE"],
      ["PAUSER_ADDRESS", PAUSER_ROLE, "PAUSER_ROLE"],
    ]) {
      const extra = process.env[envKey];
      if (extra && extra.toLowerCase() !== admin.toLowerCase()) {
        console.log(`Granting ${label} to ${extra}`);
        await (await vault.grantRole(role, extra)).wait();
      }
    }
  } else {
    console.log("
Admin != deployer: roles must be granted by the admin wallet (see README)");
  }

  // Get deploy block
  const receipt = await ethers.provider.getTransactionReceipt(deployTx.hash);
  const deployedBlock = receipt.blockNumber;

  // Save deployment record
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentRecord = {
    chainId,
    address,
    deployedBlock,
    deployer: deployer.address,
    admin,
    feeRecipient,
    feeBps: 30,
    penaltyBps: 1000,
    txHash: deployTx.hash,
    timestamp: new Date().toISOString(),
  };

  const deploymentFile = path.join(deploymentsDir, `${chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentRecord, null, 2));
  console.log("\nDeployment record saved:", deploymentFile);

  // Update src/lib/contracts/addresses.ts
  updateAddressesFile(chainId, address, deployedBlock);

  console.log("\n====================================");
  console.log("Deployment Complete!");
  console.log("====================================");
  console.log("\nNext steps:");
  console.log("1. Grant ARBITRATOR_ROLE to ops wallet:");
  console.log(`   vault.grantRole(ARBITRATOR_ROLE, "<ops-address>")`);
  console.log("2. Grant PAUSER_ROLE to ops wallet:");
  console.log(`   vault.grantRole(PAUSER_ROLE, "<ops-address>")`);

  if (network.name === "sepolia" || network.name === "polygon" || network.name === "bsc" || network.name === "mainnet") {
    console.log("\n3. Verify on Etherscan:");
    const apiKey = network.name === "sepolia" || network.name === "mainnet"
      ? process.env.ETHERSCAN_API_KEY
      : network.name === "polygon"
        ? process.env.POLYGONSCAN_API_KEY
        : process.env.BSCSCAN_API_KEY;

    if (apiKey) {
      console.log(`   npx hardhat verify --network ${network.name} ${address} "${admin}" "${feeRecipient}" 30 1000`);
    } else {
      console.log("   (Set API key in .env.local first)");
    }
  }
}

function updateAddressesFile(chainId, address, deployedBlock) {
  const addressesPath = path.join(__dirname, "..", "..", "src", "lib", "contracts", "addresses.ts");

  if (!fs.existsSync(addressesPath)) {
    console.warn("Warning: addresses.ts not found at", addressesPath);
    return;
  }

  let content = fs.readFileSync(addressesPath, "utf8");

  // Match the line for this chainId and replace it
  const pattern = new RegExp(
    `(${chainId}:\\s*\\{\\s*address:\\s*)'[^']*'(\\s*,\\s*deployedBlock:\\s*)\\d+`,
    "g"
  );

  const replacement = `$1'${address}'$2${deployedBlock}`;

  if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(addressesPath, content);
    console.log(`Updated addresses.ts for chain ${chainId}`);
  } else {
    console.warn(`Warning: Could not find entry for chain ${chainId} in addresses.ts`);
    console.log(`Please manually add:\n  ${chainId}: { address: '${address}', deployedBlock: ${deployedBlock} },`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
