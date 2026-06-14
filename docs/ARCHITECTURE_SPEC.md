# INCOGNITO — Architecture Spec
# Use this to build the dynamic HTML diagram

## NODES (what exists in the system)

### INPUT LAYER
- Node: Whistleblower Browser (frontend/index.html, localhost:3000)
  - Inputs: claim_text, evidence_summary, employee_id, company_email, tenure_years
  - Output: POST /submit to Backend API

### BACKEND LAYER
- Node: Backend API (backend/index.js, localhost:3001)
  - Receives whistleblower submission
  - Calls Mock HR API for employee verification
  - Calls Chainlink Confidential AI API (or deterministic fallback)
  - Encodes verdict and calls smart contract on Sepolia
  - Returns tx hash + verdict to frontend

- Node: Mock HR Server (backend/mock-hr.js, localhost:3002)
  - Simulates company employee registry
  - Input: employee_id + company_email
  - Output: { verified: true/false, role, department }
  - In production: replaced by ConfidentialHTTP call inside TEE

### CHAINLINK TEE LAYER — THE CORE
- Node: CRE Workflow (workflow/workflow.ts)
  - Orchestrated by Chainlink CRE SDK @chainlink/cre-sdk
  - Runs inside Chainlink Decentralized Oracle Network
  - Contains 4 sequential steps:

  - SubNode Step 1: ConfidentialHTTP → HR API
    - Input: employee_id, company_email (inside enclave)
    - Action: POST to HR verification endpoint
    - Output: verified status, role, department
    - Security guarantee: PII never exits the enclave

  - SubNode Step 2: ConfidentialHTTP → Confidential AI
    - Endpoint: confidential-ai-dev-preview.cldev.cloud
    - Model: Qwen 3.6 (34.4GB, 256K context)
    - Input: claim + evidence + verification result
    - 4-Agent Pipeline inside TEE:
      a. Agent 1 — Intake Triage: categorizes claim (FINANCIAL_FRAUD / SECURITIES_VIOLATION / WORKPLACE_SAFETY / CORRUPTION / DATA_PRIVACY / OTHER) and routes to a specialist
      b. Agent 2 — Specialist Analysis: entity extraction (people, orgs, amounts, dates, documents) + evidence cross-reference (score 1-10) + specific violations
      c. Agent 3 — Legal Assessment: maps to SOX/Dodd-Frank/OSHA/FCPA, protection level, SEC/OSHA/agency referrals + SEC award eligibility
      d. Agent 4 — Verdict Synthesis: structured attested verdict with full reasoning chain
    - Security guarantee: reasoning is cryptographically attested — cannot be faked or altered
    - First live inference ID: 019ec2ae-ff69-766b-8eec-7a88540499b7

  - SubNode Step 3: Identity Strip
    - employee_id → PURGED
    - company_email → PURGED
    - identity field → "UNKNOWABLE"
    - Only the verdict exits the enclave

  - SubNode Step 4: EVMClient.writeReport()
    - Uses viem for ABI encoding
    - Encodes: credible, severity, route, reason, timestamp
    - Calls INCOGNITORegistry.sol on Sepolia

### BLOCKCHAIN LAYER
- Node: INCOGNITORegistry.sol
  - Network: Ethereum Sepolia (Chain ID: 11155111)
  - Address: 0x2aa4206aa0b9d2434fa96c5330c17fc23709f597
  - Deployment Tx: 0x798dd81ba4e08982973287d145bcad5e426440c56e3ffae8d2fc29ce0a4cc61e
  - Deployed at Block: 11053992
  - Compiler: Solidity 0.8.19
  - Verified: Sourcify + Blockscout

  - Function: onReport(bytes metadata, bytes report)
    - Called by Chainlink DON directly
    - Implements IReceiver interface

  - Function: submitAttestation(credible, severity, route, reason, timestamp)
    - require(credible) — rejects non-credible claims at contract level
    - require(severity 1–3) — input guard

  - Events:
    - InternalReport(id, severity, reason, timestamp) — severity 1–2 → board/legal
    - PublicDisclosure(id, severity, reason, timestamp) — severity 3 → regulators/media

### OUTPUT LAYER
- Node: Etherscan (Sepolia)
  - Publicly verifiable tx record
  - Anyone with the tx hash can verify the attestation
  - No PII visible — only verdict, severity, reason, timestamp

- Node: Whistleblower receives:
  - On-chain tx hash
  - Etherscan link
  - "Your identity is cryptographically unknowable" confirmation

---

## DATA FLOW (arrows)

1. Whistleblower Browser → Backend API [POST /submit with claim + evidence + employee_proof]
2. Backend API → Mock HR Server [POST /verify with employee_id + email]
3. Mock HR Server → Backend API [{ verified: true, role, department }]
4. Backend API → Confidential AI API [4 sequential agent calls: intake triage → specialist analysis → legal assessment → verdict synthesis]
5. Confidential AI API → Backend API [attested JSON verdict]
6. Backend API → INCOGNITORegistry.sol [submitAttestation() call via ethers/viem]
7. INCOGNITORegistry.sol → Ethereum Sepolia [emit InternalReport or PublicDisclosure]
8. Ethereum Sepolia → Etherscan [publicly indexed tx]
9. Backend API → Whistleblower Browser [tx hash + verdict + identity=UNKNOWABLE]

In the CRE workflow (production path, replaces steps 2–7):
4a. CRE Workflow → ConfidentialHTTP → HR API [inside TEE]
4b. CRE Workflow → ConfidentialHTTP → Confidential AI [inside TEE]
4c. CRE Workflow → Identity Strip [inside TEE]
4d. CRE Workflow → EVMClient.writeReport() → INCOGNITORegistry.sol

---

## SECURITY GUARANTEES (for diagram labels)

- TEE boundary: Steps 4a–4c are inside the enclave. No one outside can see inputs or reasoning.
- Cryptographic attestation: The Confidential AI output is signed by the TEE. The verdict on-chain cannot be faked.
- Identity unknowability: By the time any data leaves the TEE, employee_id and email are purged. Mathematical, not policy.
- On-chain immutability: Once posted, the attestation cannot be altered. Permanent public record.

---

## TOOL/TECH LABELS FOR DIAGRAM NODES

| Node | Tool/Version |
|------|-------------|
| CRE Workflow | @chainlink/cre-sdk@1.11.0 |
| Confidential AI | Chainlink Confidential AI Attester |
| AI Model | Qwen 3.6 (256K context) |
| Smart Contract | Solidity 0.8.19 |
| ABI Encoding | viem@2.34.0 |
| Config Validation | zod@3.25.76 |
| Backend | Node.js 24 + Express |
| Package Runtime | Bun 1.3.14 |
| Wallet | MetaMask (Sepolia) |
| Network | Ethereum Sepolia — Chain ID 11155111 |

---

## KEY NUMBERS FOR DIAGRAM CALLOUTS

- Contract: 0x2aa4206aa0b9d2434fa96c5330c17fc23709f597
- First Inference: 019ec2ae-ff69-766b-8eec-7a88540499b7
- Binary Hash: d184bdafaa9b92191f9daee11855843e67f3ca96277ab6b91f36accbc50376b8
- Deployment Block: 11053992
- Listening From Block: 11054576
- Gas Used: 0.002780626406108408 Sepolia ETH
- Prompt Tokens: 194 | Completion Tokens: 1392
- SEC Award Range: 10–30% of sanctions over $1M
- SEC Whistleblower Total Paid: $1.9B since 2011
