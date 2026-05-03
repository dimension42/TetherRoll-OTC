const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  // 1. FeeDistributor (Gnosis Safe multisig address in prod)
  const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy(deployer.address);
  await feeDistributor.waitForDeployment();
  console.log("FeeDistributor:", await feeDistributor.getAddress());

  // 2. PoolRegistry
  const PoolRegistry = await ethers.getContractFactory("PoolRegistry");
  const poolRegistry = await PoolRegistry.deploy(deployer.address);
  await poolRegistry.waitForDeployment();
  console.log("PoolRegistry:", await poolRegistry.getAddress());

  // 3. EscrowVault
  const EscrowVault = await ethers.getContractFactory("EscrowVault");
  const escrowVault = await EscrowVault.deploy(
    deployer.address,
    await feeDistributor.getAddress()
  );
  await escrowVault.waitForDeployment();
  console.log("EscrowVault:", await escrowVault.getAddress());

  console.log("\n=== Update src/lib/constants.ts with these addresses ===");
  console.log(`poolRegistry: '${await poolRegistry.getAddress()}'`);
  console.log(`escrowVault: '${await escrowVault.getAddress()}'`);
  console.log(`feeDistributor: '${await feeDistributor.getAddress()}'`);
}

main().catch(e => { console.error(e); process.exit(1); });
