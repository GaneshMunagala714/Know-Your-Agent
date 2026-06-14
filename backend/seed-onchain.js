// ── INCOGNITO — seed real attestations on-chain ───────────────────────────────
//
// Writes a few REAL verdicts to the registry on Sepolia so the contract is
// non-empty and shows InternalReport / PublicDisclosure events on Etherscan.
// This is what makes the "Connect the World" claim independently verifiable.
//
// Prereqs in backend/.env:
//   CONTRACT_ADDRESS, SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY
//   The wallet must hold Sepolia ETH (grab some from a faucet).
//
// Run:  node seed-onchain.js
//
require("dotenv").config();
const { ethers } = require("ethers");

const ABI = [
  "function submitAttestation(bool credible, uint8 severity, string route, string reason, uint256 timestamp) external",
  "function totalClaims() external view returns (uint256)",
];

// severity 3 => PublicDisclosure event, severity 1-2 => InternalReport event
const SAMPLE_VERDICTS = [
  { credible: true, severity: 3, route: "public",   reason: "Verified insider claim of financial fraud assessed as critical misconduct" },
  { credible: true, severity: 2, route: "internal", reason: "Verified insider claim of workplace safety violation requiring investigation" },
  { credible: true, severity: 3, route: "public",   reason: "Verified insider claim of securities violation eligible for SEC award" },
];

async function main() {
  const { CONTRACT_ADDRESS, SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;
  if (!CONTRACT_ADDRESS || !SEPOLIA_RPC_URL || !DEPLOYER_PRIVATE_KEY) {
    console.error("Set CONTRACT_ADDRESS, SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY in backend/.env first.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  const bal = await provider.getBalance(wallet.address);
  console.log(`Wallet ${wallet.address}  balance: ${ethers.formatEther(bal)} ETH`);
  if (bal === 0n) {
    console.error("Wallet has 0 Sepolia ETH. Fund it from a faucet, then re-run.");
    process.exit(1);
  }

  console.log("Before:", (await contract.totalClaims()).toString(), "claims on-chain\n");

  for (const v of SAMPLE_VERDICTS) {
    const ts = Math.floor(Date.now() / 1000);
    process.stdout.write(`Submitting severity=${v.severity} route=${v.route} ... `);
    const tx = await contract.submitAttestation(v.credible, v.severity, v.route, v.reason, ts);
    const rcpt = await tx.wait();
    console.log(`done`);
    console.log(`  https://sepolia.etherscan.io/tx/${rcpt.hash}`);
  }

  console.log("\nAfter:", (await contract.totalClaims()).toString(), "claims on-chain");
  console.log(`Contract: https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
