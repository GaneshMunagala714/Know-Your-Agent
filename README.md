# INCOGNITO
### Provably Anonymous Whistleblowing  Powered by Chainlink Confidential AI

> *SecureDrop asks you to trust a server. INCOGNITO gives you a cryptographic proof before you hit send.*

**ETHGlobal New York 2026 · Chainlink Track**

---

## The Problem

Every year, billions of dollars in financial fraud go unreported. Not because people don't know — but because they can't prove they're insiders without revealing themselves.

The SEC Whistleblower Program pays 10–30% of sanctions over $1 million to eligible reporters. The requirement: *original information from an independent source*. The bottleneck: whistleblowers cannot prove they're verified insiders without exposing their identity.

Traditional anonymous reporting platforms like SecureDrop solve anonymity through operational security — they ask you to trust a server, a process, a human. That trust is a vulnerability.

**INCOGNITO eliminates that trust requirement entirely.**

---

## What INCOGNITO Does

INCOGNITO is a whistleblowing platform where a verified employee submits a sensitive claim and receives cryptographic proof — before they hit send — that:

1. They are a confirmed insider (employee verification inside TEE)
2. Their claim was independently assessed by a 4-agent AI pipeline (Confidential AI inside TEE)
3. Their identity was mathematically stripped — unknowable to anyone
4. The verdict was posted on-chain and is publicly verifiable by anyone with the tx hash

The whistleblower can hand a regulator a transaction hash. That hash proves a verified insider submitted credible information — without revealing who they are. **This is the first cryptographic infrastructure for whistleblower credibility without identity exposure.**

---

## Why This Only Works With Chainlink

Every component is load bearing:

| Component | Why It's Required |
|---|---|
| **Chainlink TEE** | The AI agent runs inside the enclave — not even Chainlink operators can see the reasoning |
| **Confidential HTTP** | Employee verification and AI inference both happen inside the enclave — no PII ever exits |
| **Confidential AI Attester** | The AI verdict is cryptographically signed by the TEE — it cannot be faked or altered |
| **CRE Workflow** | Orchestrates the full pipeline on a Decentralized Oracle Network — no single point of failure |
| **On-chain Attestation** | The verdict is immutable public record — anyone can verify the proof |

**Why not AWS Nitro?** AWS TEEs exist but have no native on-chain proof. You'd trust a bridge. With Chainlink, the DON posts the attestation  no single point of trust, no bridge, no intermediary.

---

## Architecture

```
Whistleblower submits:
  • Claim text
  • Evidence summary  
  • Employee ID + company email
  • Years of tenure
          │
          ▼
┌──────────────────────────────────────────────────┐
│              Chainlink DON (TEE)                  │
│                                                   │
│  STEP 1: ConfidentialHTTP → HR API               │
│    Verify employee_id + email inside enclave      │
│    Output: { verified: true, role, dept }         │
│    PII stays inside — never exits                 │
│                                                   │
│  STEP 2: ConfidentialHTTP → Confidential AI      │
│    4-agent pipeline:                              │
│    ├── Agent 1 — Intake Triage (categorize +      │
│    │   route to specialist)                       │
│    ├── Agent 2 — Specialist Analysis (entities,   │
│    │   evidence scoring 1-10, violations)         │
│    ├── Agent 3 — Legal Assessment (SEC/OSHA/DOJ,   │
│    │   SOX/Dodd-Frank protections, SEC award)     │
│    └── Agent 4 — Verdict Synthesis                │
│    Output: structured attested verdict            │
│                                                   │
│  STEP 3: Strip all identity                       │
│    employee_id  → PURGED                          │
│    company_email → PURGED                         │
│    identity     → "UNKNOWABLE"                    │
│                                                   │
│  STEP 4: EVMClient.writeReport()                 │
│    → INCOGNITORegistry.sol on Sepolia              │
└──────────────────────────────────────────────────┘
          │
          ▼
INCOGNITORegistry.sol emits:
  InternalReport   (severity 1–2) → board / legal
  PublicDisclosure (severity 3)   → regulators / media / SEC
          │
          ▼
Whistleblower receives:
  • On-chain tx hash
  • Etherscan link (publicly verifiable by anyone)
  • "Your identity is cryptographically unknowable"
```

---

## The 4-Agent AI Pipeline

All 4 agents execute inside the Chainlink TEE via Confidential AI, each specialized for a different stage of triage and assessment. The reasoning is cryptographically attested — no one can view or alter it.

### Agent 1: Intake Triage
Quickly categorizes the claim and decides whether to proceed:
- `FINANCIAL_FRAUD`, `SECURITIES_VIOLATION`, `WORKPLACE_SAFETY`, `CORRUPTION`, `DATA_PRIVACY`, or `OTHER`
- Assigns a severity hint (1=minor, 2=serious, 3=critical)
- Routes the claim to the matching specialist agent

### Agent 2: Specialist Analysis (branches by category)
A category-specific specialist (Financial Forensics, Securities Compliance, OSHA Safety, Anti-Corruption, Data Privacy, or General Compliance) performs deep analysis:
- **Entity extraction** — people, organizations, financial amounts, dates, documents
- **Evidence scoring** — 1–10 for specificity, verifiability, and corroboration
- **Specific violations** — concrete alleged violations and key risks
- **Investigation steps** — recommended next steps

### Agent 3: Legal Assessment
Maps findings to U.S. whistleblower law (Dodd-Frank 21F, SOX 806, OSHA 11(c), False Claims Act, FCPA):
- Applicable laws and relevant agencies (SEC, DOJ, OSHA, etc.)
- Protection level: `STRONG` | `MODERATE` | `WEAK` | `NONE`
- **SEC Whistleblower Program**: SEC award eligibility (10–30% on sanctions over $1M)

### Agent 4: Verdict Synthesis (on-chain)
Synthesizes all prior agent outputs into the final attested verdict:
```json
{
  "credible": true,
  "severity": 3,
  "violation_type": "FINANCIAL_FRAUD",
  "route": "public",
  "reason": "Verified insider claim of financial fraud assessed as critical misconduct",
  "protection_level": "STRONG",
  "protected_disclosure": true,
  "sec_award_eligible": true,
  "recommended_agencies": ["SEC", "DOJ"],
  "entities": { "people": [], "organizations": [], "amounts": [], "dates": [], "documents": [] },
  "evidence_quality": 8,
  "identity": "UNKNOWABLE"
}
```

---

## Chainlink Prize Qualification

###  Confidential AI Attester ($4,000)
-  Uses Chainlink Confidential AI inference APIs (confidential-ai-dev-preview.cldev.cloud)
-  Live inference submitted at ETHGlobal — ID: `019ec2ae-ff69-766b-8eec-7a88540499b7`
-  Processes: financial documents, identity information, compliance records
-  Verifiable AI reasoning on-chain for compliance use case
-  Smart contract consumes attested verdict for routing decisions

###  Best CRE Workflow ($2,000)
-  Integrates blockchain with HR API (Confidential HTTP) + Confidential AI (LLM)
-  CRE CLI simulation successful — compiled, scanning live Sepolia blocks (block 11054576+)
-  Binary hash: `d184bdafaa9b92191f9daee11855843e67f3ca96277ab6b91f36accbc50376b8`
-  Workflow is load-bearing — without it there is no pipeline

###  Connect the World ($1,000)
-  Smart contract state change on Sepolia via Chainlink
-  `INCOGNITORegistry.sol` emits events based on attested AI verdict
-  Contract: `0x2aa4206aa0b9d2434fa96c5330c17fc23709f597`

---

## Confidential AI — Live Proof

First inference at ETHGlobal NYC 2026:

```
Inference ID: 019ec2ae-ff69-766b-8eec-7a88540499b7
Model: qwen3.6 (256K context, 34.4GB)
Status: completed
Prompt tokens: 194 | Completion tokens: 1392

Output:
{
  "credible": true,
  "severity": 3,
  "reason": "The claim provides specific, quantifiable financial details and
             corroborating evidence of an unregistered vendor that strongly
             indicate credible fraud.",
  "route": "internal"
}
```

Processed inside Chainlink TEE. Cryptographically attested. Identity unknowable.

---

## Smart Contract

**INCOGNITORegistry** — Sepolia:
```
0x2aa4206aa0b9d2434fa96c5330c17fc23709f597
```
Verified on Sourcify ✓ | Verified on Blockscout ✓

Implements `IReceiver` — receives signed reports from Chainlink DON:

```solidity
function submitAttestation(
    bool credible,
    uint8 severity,      // 1=minor 2=serious 3=critical
    string route,        // "internal" or "public"
    string reason,       // AI verdict sentence
    uint256 timestamp
) external

// require(credible) — junk claims rejected at contract level
// severity 1-2 → emit InternalReport → board/legal
// severity 3   → emit PublicDisclosure → regulators/media
```

Deployment tx: `0x798dd81ba4e08982973287d145bcad5e426440c56e3ffae8d2fc29ce0a4cc61e`

---

## CRE Workflow

Core pipeline using `@chainlink/cre-sdk`:

```typescript
// Step 1: Confidential HTTP — employee verification inside TEE
const confidentialHttp = new cre.capabilities.ConfidentialHTTPClient()
const verification = confidentialHttp.sendRequest(runtime, {
  request: { url: config.hr_api_url, method: 'POST', bodyString: ... }
}).result()

// Step 2: Confidential AI — 6-step agent assessment inside TEE
const verdict = confidentialHttp.sendRequest(runtime, {
  request: { url: 'confidential-ai-dev-preview.cldev.cloud/v1/inference', ... }
}).result()

// Step 3: Strip identity — only verdict exits enclave
const output = { ...verdict, identity: 'UNKNOWABLE' }

// Step 4: Write to chain
const encodedPayload = encodeAbiParameters([...], [credible, severity, route, reason, timestamp])
evmClient.writeReport(runtime, { receiver: registryAddress, report })
```

---

## Real-World Impact

The SEC Whistleblower Program has paid over **$1.9 billion** in awards since 2011. The average award is $5.4 million. The barrier is always the same: credibility without identity exposure.

INCOGNITO attestations could:
- Accompany SEC filings as cryptographic proof of insider status
- Serve as evidence in OSHA retaliation cases
- Enable anonymous proof-of-insider for financial regulators globally
- Power compliance infrastructure for enterprise whistleblower programs

**This is not a privacy tool. This is infrastructure for the next generation of financial enforcement.**

---

## Running Locally

### Backend (3 terminals)

```bash
# Terminal 1 — Mock HR verification
cd backend && npm install && node mock-hr.js
# → http://localhost:3002

# Terminal 2 — Main API
cd backend && node index.js  
# → http://localhost:3001

# Terminal 3 — Frontend
cd frontend && npx serve .
# → http://localhost:3000
```

### CRE Simulation

```bash
cd cre-workflow/INCOGNITO
cre login
bun install --cwd ./my-workflow
cre workflow simulate my-workflow
# Select: staging-settings
```

Expected:
```
✓ Workflow compiled
✓ Simulation limits enabled
Binary hash: d184bdafaa9b92191f9daee11855843e67f3ca96277ab6b91f36accbc50376b8
Chain: ethereum-testnet-sepolia
Contract: 0x2AA4206Aa0B9d2434fa96c5330C17fc23709f597
Listening for logs starting at block 11054576...
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| TEE Orchestration | Chainlink CRE SDK `@chainlink/cre-sdk@1.11.0` |
| Confidential AI | Chainlink Confidential AI Attester (cldev.cloud) |
| Smart Contract | Solidity 0.8.19 — INCOGNITORegistry + IReceiver |
| ABI Encoding | viem |
| Config Validation | zod |
| Backend | Node.js 24 + Express |
| Network | Ethereum Sepolia (Chain ID 11155111) |

---

## Build Timeline

| Milestone | Achievement |
|---|---|
| Concept pitch | Chainlink team engaged, API key received, Confidential AI feedback given |
| First inference | ID `019ec2ae` — clean JSON verdict from inside TEE |
| Contract deployed | `0x2aa4...f597` on Sepolia — verified Sourcify + Blockscout |
| CRE simulation live | Compiled, scanning block 11054576+ on Sepolia |
| 4-agent NLP pipeline | Intake triage, specialist analysis, legal assessment, verdict synthesis |
| Full demo working | Form → TEE → verdict → on-chain → Etherscan |

---

## Docs

- [Architecture Spec](docs/ARCHITECTURE_SPEC.md) - full node/data-flow breakdown for diagramming
- [Demo Script](docs/DEMO_SCRIPT.md) — screen recording walkthrough

---

## Team

**Shruti Brahma** \
**Ganesh Munagala**

