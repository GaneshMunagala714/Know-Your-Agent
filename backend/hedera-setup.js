require("dotenv").config();
const { createTopic, createReceiptToken } = require("./hedera");

async function setup() {
  console.log("INCOGNITO — Hedera one-time setup\n");

  // Skip topic creation if already set in .env
  let topicId = process.env.HEDERA_TOPIC_ID;
  if (!topicId) {
    console.log("Creating HCS audit topic...");
    topicId = await createTopic();
  } else {
    console.log("HCS topic already set:", topicId);
  }

  console.log("\nCreating HTS verdict receipt token (IVR NFT)...");
  const tokenId = await createReceiptToken();

  console.log("\n────────────────────────────────────────");
  console.log("Paste these into backend/.env:\n");
  console.log(`HEDERA_TOPIC_ID=${topicId}`);
  console.log(`HEDERA_TOKEN_ID=${tokenId}`);
  console.log("\nThen verify on HashScan:");
  console.log(`https://hashscan.io/testnet/topic/${topicId}`);
  console.log("────────────────────────────────────────");
}

setup().catch(err => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
