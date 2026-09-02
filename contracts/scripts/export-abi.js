const fs = require("fs");
const path = require("path");

async function main() {
  console.log("====================================");
  console.log("Exporting ABI to src/lib/contracts/abi.ts");
  console.log("====================================");

  // Read compiled artifact
  const artifactPath = path.join(__dirname, "..", "artifacts", "src", "EscrowVault.sol", "EscrowVault.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("Error: EscrowVault.json not found. Run 'npx hardhat compile' first.");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;

  // Generate TypeScript file
  const output = `import { parseAbi } from 'viem';

/**
 * EscrowVault v2 ABI — docs/CONTRACT_V2_SPEC.md 와 1:1.
 * WS1이 컴파일 산출물에서 \`export-abi.js\`로 재생성한다. 시그니처가 바뀌면 반드시 여기도 갱신.
 */
export const escrowVaultAbi = ${JSON.stringify(abi, null, 2)} as const;

export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);

/** 컨트랙트 enum ↔ DB status 매핑 */
export const POOL_STATUS_ONCHAIN = ['OPEN', 'FILLED', 'CANCELLED', 'EXPIRED'] as const;
export const TRADE_STATUS_ONCHAIN = [
  'AWAITING_BOND', 'ACTIVE', 'PAID', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'RESOLVED',
] as const;
`;

  // Write to src/lib/contracts/abi.ts
  const outputPath = path.join(__dirname, "..", "..", "src", "lib", "contracts", "abi.ts");
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, output);

  console.log("✓ ABI exported to:", outputPath);
  console.log("✓ Functions:", abi.filter(x => x.type === "function").length);
  console.log("✓ Events:", abi.filter(x => x.type === "event").length);
  console.log("✓ Errors:", abi.filter(x => x.type === "error").length);
  console.log("\nNext: Run 'npx tsc --noEmit' from worktree root to verify frontend types.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
