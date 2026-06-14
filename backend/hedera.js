const {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenType,
  TokenSupplyType,
} = require("@hashgraph/sdk");

function getPrivateKey() {
  const raw = process.env.HEDERA_PRIVATE_KEY || "";
  // Portal gives HEX-encoded ECDSA keys — use fromStringECDSA
  return PrivateKey.fromStringECDSA(raw.replace(/^0x/, ""));
}

function getClient() {
  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    throw new Error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in .env");
  }
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
    getPrivateKey()
  );
  return client;
}

// Run once via hedera-setup.js — paste output into .env
async function createTopic() {
  const client = getClient();
  const tx = await new TopicCreateTransaction()
    .setTopicMemo("INCOGNITO Whistleblower Audit Trail — ETHGlobal NYC 2026")
    .execute(client);
  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId.toString();
  console.log("[Hedera] HCS topic created:", topicId);
  return topicId;
}

// Run once via hedera-setup.js — paste output into .env
async function createReceiptToken() {
  const client = getClient();
  const supplyKey = getPrivateKey();

  const tx = await new TokenCreateTransaction()
    .setTokenName("INCOGNITO Verdict Receipt")
    .setTokenSymbol("IVR")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(10000)
    .setTreasuryAccountId(AccountId.fromString(process.env.HEDERA_ACCOUNT_ID))
    .setSupplyKey(supplyKey)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const tokenId = receipt.tokenId.toString();
  console.log("[Hedera] HTS token created:", tokenId);
  return tokenId;
}

// Called after every verdict — logs to HCS and mints one NFT receipt
async function logVerdictToHedera(verdictData) {
  const topicId = process.env.HEDERA_TOPIC_ID;
  const tokenId = process.env.HEDERA_TOKEN_ID;

  if (!topicId || !tokenId) {
    console.warn("[Hedera] HEDERA_TOPIC_ID or HEDERA_TOKEN_ID not set — run hedera-setup.js first");
    return { hcs_sequence: null, nft_serial: null, topic_id: null, token_id: null };
  }

  const client = getClient();

  // HCS message: audit context without raw claim content
  const message = JSON.stringify({
    verdict:      verdictData.verdict,
    claim_hash:   verdictData.claimHash,
    sepolia_tx:   verdictData.sepoliaTxHash,
    violation:    verdictData.violation,
    severity:     verdictData.severity,
    ledger_signer:verdictData.ledgerSigner,
    timestamp:    new Date().toISOString(),
    inference_id: verdictData.inferenceId || null,
  });

  // Step 1: Submit verdict context to HCS topic
  const hcsTx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .execute(client);

  const hcsReceipt = await hcsTx.getReceipt(client);
  const sequenceNumber = hcsReceipt.topicSequenceNumber.toString();
  console.log(`[Hedera] ✓ HCS sequence #${sequenceNumber}`);

  // Step 2: Mint NFT receipt — compact metadata to stay under 100-byte HTS limit
  let serial = null;
  try {
    const meta = `${verdictData.verdict}|seq:${sequenceNumber}|${new Date().toISOString().slice(0,10)}`;
    const mintTx = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata([Buffer.from(meta)])
      .execute(client);

    const mintReceipt = await mintTx.getReceipt(client);
    serial = mintReceipt.serials[0].toString();
    console.log(`[Hedera] ✓ NFT serial #${serial}`);
  } catch (mintErr) {
    console.warn("[Hedera] NFT mint failed (non-fatal):", mintErr.message);
  }

  console.log(`[Hedera] https://hashscan.io/testnet/topic/${topicId}`);

  return {
    hcs_sequence: sequenceNumber,
    nft_serial:   serial,
    topic_id:     topicId,
    token_id:     tokenId,
    hashscan_url: `https://hashscan.io/testnet/topic/${topicId}`,
  };
}

module.exports = { createTopic, createReceiptToken, logVerdictToHedera };
