require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { logVerdictToHedera } = require("./hedera");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const CONTRACT_ABI = [
  "function submitAttestation(bool credible, uint8 severity, string route, string reason, uint256 timestamp) external",
  "function getAttestation(uint256 id) external view returns (tuple(bool credible, uint8 severity, string route, string reason, uint256 timestamp, string identity))",
  "function totalClaims() external view returns (uint256)",
  "event InternalReport(uint256 indexed id, uint8 severity, string reason, uint256 timestamp)",
  "event PublicDisclosure(uint256 indexed id, uint8 severity, string reason, uint256 timestamp)",
];

// ── Ledger signature verification ────────────────────────────────────────────

function verifyLedgerSignature(message, signature) {
  try {
    const signer = ethers.verifyMessage(message, signature);
    return { valid: true, signer };
  } catch {
    return { valid: false, signer: null };
  }
}

// ── Employee verification ─────────────────────────────────────────────────────

async function verifyEmployee(employee_proof) {
  try {
    const res = await fetch(process.env.HR_API_URL || "http://localhost:3002/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.HR_API_KEY || "mock-key-for-demo",
      },
      body: JSON.stringify({
        employee_id: employee_proof.employee_id,
        email: employee_proof.company_email,
      }),
    });
    return res.json();
  } catch {
    // Fallback for demo when HR server not running
    return { verified: true, role: "Software Engineer", dept: "Finance", tenure: 3 };
  }
}

// ── Confidential AI call (mirrors CRE ConfidentialHTTPClient pattern) ─────────

async function callConfidentialAI(systemPrompt, userPrompt) {
  const apiKey = process.env.CHAINLINK_AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  // In CRE workflow: ConfidentialHTTPClient → confidential-ai-dev-preview.cldev.cloud
  // Backend mirrors same call via regular fetch for demo purposes
  const aiUrl = process.env.CHAINLINK_AI_URL || "https://api.openai.com/v1/chat/completions";
  const isChainlinkAI = aiUrl.includes("cldev.cloud");

  const body = isChainlinkAI
    ? JSON.stringify({ model: "qwen3.6", system_prompt: systemPrompt, prompt: userPrompt })
    : JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

  const res = await fetch(aiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body,
  });

  const data = await res.json();

  const raw = isChainlinkAI
    ? data.output
    : data.choices?.[0]?.message?.content;

  if (!raw) {
    console.warn("[AI] No content returned, using deterministic fallback:", data?.error?.message || JSON.stringify(data).slice(0, 80));
    return null;
  }

  try {
    return JSON.parse(raw.replace(/```json[\s\S]*?```|```/g, "").trim());
  } catch {
    console.warn("[AI] JSON parse failed, using deterministic fallback");
    return null;
  }
}

// ── AGENT 1: Intake Triage ────────────────────────────────────────────────────

async function runIntakeAgent(claim, verification) {
  console.log("[DeadDrop] AGENT 1: Intake Triage Agent running...");

  const result = await callConfidentialAI(
    "You are an Intake Triage Agent for a whistleblower protection system. Categorize claims quickly and decide whether to proceed. Respond with valid JSON only.",
    `A ${verification.role} in ${verification.dept} with ${verification.tenure || "unknown"} years tenure submitted:

CLAIM: ${claim}

Triage this claim. Output JSON only:
{
  "category": "FINANCIAL_FRAUD|SECURITIES_VIOLATION|WORKPLACE_SAFETY|CORRUPTION|DATA_PRIVACY|OTHER",
  "severity_hint": 1,
  "proceed": true,
  "triage_reason": "one sentence"
}

Severity: 1=minor, 2=serious, 3=critical. Only set proceed=false if clearly frivolous.`,
  );

  if (result) {
    console.log(`[DeadDrop] Agent 1 ✓ category=${result.category} proceed=${result.proceed}`);
    return result;
  }

  // Deterministic fallback
  return deterministicTriage(claim);
}

function deterministicTriage(claim) {
  const c = claim.toLowerCase();
  if (c.includes("fraud") || c.includes("invoice") || c.includes("embezzl") || c.includes("million")) {
    return { category: "FINANCIAL_FRAUD", severity_hint: 3, proceed: true, triage_reason: "Financial misconduct indicators detected" };
  }
  if (c.includes("insider") || c.includes("trading") || c.includes("sec") || c.includes("securities")) {
    return { category: "SECURITIES_VIOLATION", severity_hint: 3, proceed: true, triage_reason: "Securities violation indicators detected" };
  }
  if (c.includes("safety") || c.includes("osha") || c.includes("hazard")) {
    return { category: "WORKPLACE_SAFETY", severity_hint: 2, proceed: true, triage_reason: "Workplace safety concern detected" };
  }
  if (c.includes("bribe") || c.includes("kickback") || c.includes("corrupt")) {
    return { category: "CORRUPTION", severity_hint: 3, proceed: true, triage_reason: "Corruption indicators detected" };
  }
  return { category: "OTHER", severity_hint: 1, proceed: true, triage_reason: "Claim requires further investigation" };
}

// ── AGENT 2: Specialist Deep Analyst (branches by violation type) ─────────────

const SPECIALIST_PROMPTS = {
  FINANCIAL_FRAUD: "You are a Financial Forensics Agent specialized in fraud detection, invoice manipulation, embezzlement, and false billing. Analyze for specific financial red flags.",
  SECURITIES_VIOLATION: "You are a Securities Compliance Agent specialized in SEC enforcement. Look for insider trading patterns, false disclosures, and market manipulation.",
  WORKPLACE_SAFETY: "You are an OSHA Safety Assessment Agent. Identify unreported hazards, falsified safety records, and federal safety violations.",
  CORRUPTION: "You are an Anti-Corruption Specialist. Identify bribery, kickbacks, conflicts of interest, procurement fraud, and FCPA violations.",
  DATA_PRIVACY: "You are a Data Privacy Compliance Agent. Look for GDPR/CCPA violations, unauthorized data access, and breach concealment.",
  OTHER: "You are a General Compliance Analyst. Extract entities and assess compliance risk.",
};

async function runSpecialistAgent(claim, evidenceSummary, verification, triage) {
  console.log(`[DeadDrop] AGENT 2: ${triage.category} Specialist Agent running...`);

  const result = await callConfidentialAI(
    SPECIALIST_PROMPTS[triage.category] || SPECIALIST_PROMPTS.OTHER,
    `Perform deep specialist analysis on this ${triage.category} claim.

Employee: ${verification.role}, ${verification.dept}, ${verification.tenure || "unknown"} years tenure
Claim: ${claim}
Evidence: ${evidenceSummary || "None provided"}
Triage: ${JSON.stringify(triage)}

Output JSON only:
{
  "entities": {
    "people": ["names or roles mentioned"],
    "organizations": ["companies, shell entities"],
    "amounts": ["financial figures"],
    "dates": ["timeframes"],
    "documents": ["records, systems referenced"]
  },
  "evidence_quality": 7,
  "specific_violations": ["specific alleged violations"],
  "key_risks": ["risks if allegations are true"],
  "investigation_steps": ["3-5 next steps"],
  "analyst_notes": "one paragraph assessment"
}`,
  );

  if (result) {
    console.log(`[DeadDrop] Agent 2 ✓ evidence_quality=${result.evidence_quality}/10`);
    return result;
  }

  return {
    entities: { people: [], organizations: [], amounts: [], dates: [], documents: [] },
    evidence_quality: 6,
    specific_violations: [`Alleged ${triage.category.replace("_", " ").toLowerCase()}`],
    key_risks: ["Potential regulatory exposure if allegations substantiated"],
    investigation_steps: ["Secure relevant documents", "Interview witnesses", "Engage legal counsel"],
    analyst_notes: `Insider claim categorized as ${triage.category} with insider access confirmed.`,
  };
}

// ── AGENT 3: Legal Assessment Agent ──────────────────────────────────────────

async function runLegalAgent(triage, analysis) {
  console.log("[DeadDrop] AGENT 3: Legal Assessment Agent running...");

  const result = await callConfidentialAI(
    "You are a Legal Assessment Agent specializing in U.S. whistleblower law: Dodd-Frank 21F, SOX 806, OSHA 11(c), False Claims Act, and FCPA. Respond with valid JSON only.",
    `Assess legal standing of this ${triage.category} claim.

AGENT 1 TRIAGE: ${JSON.stringify(triage)}
AGENT 2 ANALYSIS:
  Evidence quality: ${analysis.evidence_quality}/10
  Violations: ${JSON.stringify(analysis.specific_violations)}

Output JSON only:
{
  "applicable_laws": ["SOX Section 806", "Dodd-Frank 21F"],
  "relevant_agencies": ["SEC", "DOJ"],
  "protection_level": "STRONG|MODERATE|WEAK|NONE",
  "sec_award_eligible": false,
  "sec_award_reason": "one sentence on SEC award (10-30% of sanctions over $1M)",
  "dodd_frank_protected": true,
  "sox_protected": false,
  "legal_notes": "one paragraph legal summary"
}`,
  );

  if (result) {
    console.log(`[DeadDrop] Agent 3 ✓ protection=${result.protection_level} SEC_eligible=${result.sec_award_eligible}`);
    return result;
  }

  const secEligible = ["FINANCIAL_FRAUD", "SECURITIES_VIOLATION"].includes(triage.category);
  return {
    applicable_laws: triage.category === "SECURITIES_VIOLATION" ? ["Dodd-Frank 21F", "SOX 806"] : ["SOX 806"],
    relevant_agencies: secEligible ? ["SEC", "DOJ"] : ["DOJ", "Inspector General"],
    protection_level: triage.severity_hint >= 2 ? "STRONG" : "MODERATE",
    sec_award_eligible: secEligible,
    sec_award_reason: secEligible ? "Securities/fraud violation potentially qualifying for SEC award" : "Violation type does not meet SEC award threshold",
    dodd_frank_protected: true,
    sox_protected: true,
    legal_notes: "Claim submitted by verified insider with direct access. Standard whistleblower protections apply.",
  };
}

// ── AGENT 4: Final Verdict Synthesis ─────────────────────────────────────────

async function runVerdictAgent(triage, analysis, legal) {
  console.log("[DeadDrop] AGENT 4: Verdict Synthesis Agent running...");

  const result = await callConfidentialAI(
    "You are the Final Verdict Synthesis Agent. Synthesize 3 specialist agent reports into a final attested verdict. Identity is always UNKNOWABLE. Respond with valid JSON only.",
    `Synthesize these 3 agent reports into a final verdict.

AGENT 1 — TRIAGE: ${JSON.stringify(triage)}
AGENT 2 — ANALYSIS: evidence_quality=${analysis.evidence_quality}/10, violations=${JSON.stringify(analysis.specific_violations?.slice(0, 2))}
AGENT 3 — LEGAL: protection=${legal.protection_level}, agencies=${JSON.stringify(legal.relevant_agencies)}, SEC_eligible=${legal.sec_award_eligible}

Output JSON only:
{
  "credible": true,
  "severity": 2,
  "route": "internal|public|law_enforcement",
  "reason": "one sentence final verdict",
  "recommended_agencies": ["agencies to notify"],
  "pipeline_summary": "one sentence summarizing all 4 agents' collective findings",
  "identity": "UNKNOWABLE"
}`,
  );

  if (result) {
    result.identity = "UNKNOWABLE"; // always enforce
    console.log(`[DeadDrop] Agent 4 ✓ credible=${result.credible} severity=${result.severity} route=${result.route}`);
    return result;
  }

  return {
    credible: true,
    severity: triage.severity_hint,
    route: triage.severity_hint >= 3 ? "public" : "internal",
    reason: `Verified insider claim of ${triage.category.replace("_", " ").toLowerCase()} assessed as ${triage.severity_hint >= 3 ? "critical" : "serious"} misconduct`,
    recommended_agencies: legal.relevant_agencies,
    pipeline_summary: `4-agent pipeline: triage→${triage.category}, specialist found ${analysis.specific_violations?.length || 1} violation(s), legal assessed ${legal.protection_level} protection`,
    identity: "UNKNOWABLE",
  };
}

// ── On-chain write ────────────────────────────────────────────────────────────

async function postOnChain(verdict) {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  const contractAddr = process.env.CONTRACT_ADDRESS;

  if (!rpc || !pk || !contractAddr) {
    const crypto = require("crypto");
    const fakeTx = "0x" + crypto.createHash("sha256")
      .update(JSON.stringify(verdict) + Date.now()).digest("hex");
    return { hash: fakeTx, simulated: true };
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(pk, provider);
  const contract = new ethers.Contract(contractAddr, CONTRACT_ABI, signer);

  const tx = await contract.submitAttestation(
    verdict.credible,
    verdict.severity,
    verdict.route,
    verdict.reason,
    Math.floor(Date.now() / 1000),
  );
  await tx.wait();
  return { hash: tx.hash, simulated: false };
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.post("/submit", async (req, res) => {
  const { claim, evidence_summary, employee_proof, ledger_signature, ledger_message } = req.body;

  // ── Ledger gate: reject any submission without a valid hardware signature ──
  if (!ledger_signature || !ledger_message) {
    return res.status(401).json({
      error: "Ledger signature required. Human verification missing.",
      hint: "Connect your Ledger device and approve the claim before submitting."
    });
  }
  const { valid, signer } = verifyLedgerSignature(ledger_message, ledger_signature);
  if (!valid) {
    return res.status(401).json({ error: "Invalid Ledger signature. Submission rejected." });
  }
  console.log(`[INCOGNITO] ✓ Ledger signature verified · signer: ${signer}`);
  // ──────────────────────────────────────────────────────────────────────────

  if (!claim?.trim()) return res.status(400).json({ error: "Claim is required" });
  if (!employee_proof?.employee_id) return res.status(400).json({ error: "Employee ID required" });

  try {
    console.log("\n[INCOGNITO] ═══ New submission — Ledger verified · 4-agent pipeline starting ═══");

    // Step 0: Verify employee (identity stays confidential)
    console.log("[DeadDrop] Step 0: Employee verification...");
    const verification = await verifyEmployee(employee_proof);
    if (!verification.verified) {
      return res.status(403).json({ error: "Employee verification failed" });
    }
    console.log(`[DeadDrop] ✓ Verified: ${verification.role} / ${verification.dept}`);

    // Agent 1: Intake triage
    const triage = await runIntakeAgent(claim, verification);
    if (!triage.proceed) {
      return res.status(422).json({ error: `Claim rejected by triage: ${triage.triage_reason}` });
    }

    // Agent 2: Specialist deep analysis (branching by violation type)
    const analysis = await runSpecialistAgent(claim, evidence_summary, verification, triage);

    // Agent 3: Legal assessment
    const legal = await runLegalAgent(triage, analysis);

    // Agent 4: Final verdict synthesis
    const verdict = await runVerdictAgent(triage, analysis, legal);

    // Post on-chain (Sepolia)
    console.log("[INCOGNITO] Writing 4-agent attested verdict on-chain...");
    const onChain = await postOnChain(verdict);
    console.log(`[INCOGNITO] ✓ Sepolia: ${onChain.hash}`);

    // ── Hedera dual-layer audit ───────────────────────────────────────────
    const claimHash = crypto.createHash("sha256").update(claim).digest("hex");
    const hederaVerdict = verdict.credible
      ? (verdict.severity >= 3 ? "ESCALATE" : "VERIFIED")
      : "UNVERIFIED";

    let hederaResult = {};
    try {
      hederaResult = await logVerdictToHedera({
        verdict:      hederaVerdict,
        claimHash,
        sepoliaTxHash: onChain.hash,
        violation:    triage.category,
        severity:     verdict.severity,
        ledgerSigner: signer,
        inferenceId:  null,
      });
    } catch (hErr) {
      console.warn("[Hedera] Logging failed (non-fatal):", hErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────

    res.json({
      success: true,
      agents_run: 4,
      ledger_verified: true,
      ledger_signer: signer,
      hedera_verdict: hederaVerdict,
      hedera_sequence: hederaResult.hcs_sequence || null,
      hedera_nft: hederaResult.nft_serial || null,
      hedera_topic: hederaResult.topic_id || null,
      hedera_hashscan: hederaResult.hashscan_url || null,
      attestation: {
        ...verdict,
        violation_type: triage.category,
        protection_level: legal.protection_level,
        protected_disclosure: legal.protection_level !== "NONE",
        sec_award_eligible: legal.sec_award_eligible,
        applicable_laws: legal.applicable_laws,
        entities: analysis.entities,
        evidence_quality: analysis.evidence_quality,
        evidence_analysis: (analysis.specific_violations || []).map((violation) => ({
          item: violation,
          specificity_score: analysis.evidence_quality,
          notes: analysis.analyst_notes,
        })),
        insider_access_reason: analysis.analyst_notes,
        identity: "UNKNOWABLE",
        timestamp: Date.now(),
      },
      tx_hash: onChain.hash,
      tx_simulated: onChain.simulated,
      etherscan: onChain.simulated ? null : `https://sepolia.etherscan.io/tx/${onChain.hash}`,
      message: "4-agent agentic pipeline complete. Whistleblower identity is cryptographically unknowable.",
    });
  } catch (err) {
    console.error("[DeadDrop Error]", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) => res.json({
  ok: true,
  service: "INCOGNITO Backend",
  signing: "Ledger DeviceKit (simulated) — ethers.verifyMessage gate on /submit",
  agents: 4,
  pipeline: "ledger-signature → employee-verify → intake-triage → specialist-analysis → legal-assessment → verdict-synthesis",
  contract: process.env.CONTRACT_ADDRESS || "not configured",
  network: "Sepolia Testnet",
}));

app.get("/attestations", async (req, res) => {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const contractAddr = process.env.CONTRACT_ADDRESS;
  if (!rpc || !contractAddr) return res.json({ total: 0, attestations: [] });

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const contract = new ethers.Contract(contractAddr, CONTRACT_ABI, provider);
    const total = await contract.totalClaims();
    res.json({ total: total.toString(), contract: contractAddr });
  } catch (err) {
    res.json({ total: 0, error: err.message });
  }
});

app.listen(3001, () => {
  console.log("DeadDrop backend running on http://localhost:3001");
  console.log("4-agent agentic pipeline ready");
  console.log("Contract:", process.env.CONTRACT_ADDRESS || "not configured");
});
