# INCOGNITO — Screen Recording Demo Script
# Format: [SCREEN] what to show | [VOICE] what to say

Total runtime: ~4 minutes
Tone: calm, confident, matter-of-fact — not excited, not salesy

---

## STARTUP SEQUENCE (before recording starts)

Have these ready BEFORE hitting record:
- Terminal 1: running `node mock-hr.js` (port 3002)
- Terminal 2: running `node index.js` (port 3001) — backend live
- Terminal 3: running `npx serve .` in /frontend (port 3000)
- Terminal 4: running `cre workflow simulate staging-settings` — scanning blocks
- Browser tab 1: http://localhost:3000 (the form)
- Browser tab 2: Etherscan Sepolia → contract 0x2aa4206aa0b9d2434fa96c5330c17fc23709f597
- Browser tab 3: Chainlink Confidential AI playground (inference result loaded)
- MetaMask: connected to Sepolia

---

## SEGMENT 1 — THE PROBLEM (0:00–0:30)

[SCREEN] Open with the INCOGNITO frontend at localhost:3000. Just show the form, nothing filled in yet.

[VOICE]
"Every year, billions of dollars in financial fraud go unreported. Not because employees don't know — but because they can't prove they're insiders without revealing themselves.

The SEC whistleblower program pays 10 to 30 percent of sanctions over a million dollars. But to qualify, you need to prove you're a real insider. And to prove that — you'd have to reveal who you are.

INCOGNITO solves this with a cryptographic guarantee, not a promise."

---

## SEGMENT 2 — THE SUBMISSION (0:30–1:00)

[SCREEN] Fill in the form live as you talk. Type slowly so it reads on screen.

Claim: "My manager has been approving duplicate invoices to an unregistered shell company for six months. I have direct access to the accounts payable system and have seen the records myself."

Evidence: "Duplicate payments totaling $4.2M to vendor TechSupply LLC. Vendor does not appear in the official vendor registry. Round-dollar amounts, no PO numbers, no receiving records."

Employee ID: EMP-4821
Company Email: test@acmecorp.com
Years at company: 3

[VOICE]
"A whistleblower opens INCOGNITO. They write their claim. They attach evidence. They enter their employee credentials — not to identify themselves publicly, but to prove to the system they're a real insider.

Then they hit submit. And here's what happens."

[SCREEN] Hit submit. Show the 5-step loading animation firing.

---

## SEGMENT 3 — THE AGENT PIPELINE (1:00–1:45)

[SCREEN] While the loading animation runs, switch to Terminal 2 (backend). Show the logs — inference request firing, steps processing.

[VOICE]
"The submission goes to a Chainlink Trusted Execution Environment — a TEE. Inside that enclave, three things happen that cannot happen anywhere else.

First: the employee credentials are verified against a company HR registry via Confidential HTTP — a Chainlink capability that makes the API call inside the enclave. The identity information never exits.

Second: the claim and evidence go to the Chainlink Confidential AI Attester — an LLM running inside the TEE. It runs a 4-agent pipeline: intake triage, specialist analysis, legal assessment, and verdict synthesis."

[SCREEN] Switch to the Chainlink Confidential AI playground tab. Show the inference ID and the output JSON.

[VOICE]
"This is the live inference result from ETHGlobal. Inference ID: zero-one-nine-ec-two-ae. The model extracted entities from the claim — people, organizations, financial amounts. It scored each piece of evidence from one to ten. It classified the violation type as financial fraud. It assessed insider access — does this person's role give them plausible knowledge of this? Yes.

And it assessed SEC whistleblower eligibility — the amount is over one million dollars, so the claimant could qualify for a ten to thirty percent award.

Then: severity three. Route: public. Credible: true."

---

## SEGMENT 4 — ON-CHAIN (1:45–2:30)

[SCREEN] Switch back to the frontend. The result card should be visible now. Scroll through it slowly — show entities, evidence scores, legal assessment, recommended agencies, tx hash.

[VOICE]
"Third: before anything leaves the TEE, all identity fields are stripped. Employee ID — purged. Company email — purged. The identity field reads: UNKNOWABLE. Mathematical, not policy.

The verdict is encoded and posted to the smart contract on Ethereum Sepolia."

[SCREEN] Click the Etherscan link in the result card. Show the transaction.

[VOICE]
"This transaction is the proof. Anyone — a regulator, a journalist, a lawyer — can look up this hash and see: a verified insider submitted a credible claim of financial fraud, severity three, routed to public disclosure. And nobody knows who they are."

[SCREEN] Switch to the Etherscan tab with the contract address already loaded. Show the contract events — InternalReport or PublicDisclosure events.

[VOICE]
"The smart contract emits one of two events depending on severity. Severity one or two goes internal — to the company's board and legal team. Severity three — the highest — goes public. Regulators, media, the SEC.

The contract rejects non-credible claims at the contract level. Junk never hits chain."

---

## SEGMENT 5 — THE CRE WORKFLOW (2:30–3:15)

[SCREEN] Switch to Terminal 4. Show the CRE simulation running — the green checkmarks, the binary hash, scanning blocks.

[VOICE]
"The production path for this is a Chainlink CRE workflow — the Chainlink Runtime Environment. This is a TypeScript workflow that orchestrates the entire pipeline on a decentralized oracle network.

Watch: workflow compiled — green. Simulation limits enabled. It's watching the deployed contract on Sepolia, scanning live blocks.

Binary hash: d-one-eight-four-b-d-af. This is a reproducible build — anyone can verify this binary is running exactly the code in the repo.

The CRE workflow makes Chainlink load-bearing, not decorative. Without the TEE, there's no credibility guarantee. Without the DON, there's no decentralized attestation. Without the on-chain posting, there's no public record."

---

## SEGMENT 6 — WHY THIS ONLY WORKS WITH CHAINLINK (3:15–3:45)

[SCREEN] Show a side-by-side: the Chainlink Confidential AI playground (TEE inference) on one side, Etherscan (on-chain proof) on the other.

[VOICE]
"AWS Nitro TEEs exist. But they have no native on-chain posting. You'd need a bridge — which means you're trusting an intermediary again.

With Chainlink, the DON posts the attestation. No single point of trust. No bridge. No middleman.

The Chainlink Confidential AI Attester is the only stack in the world where you can say: an LLM assessed this claim, nobody tampered with that reasoning, and here's the cryptographic proof on a public blockchain."

---

## SEGMENT 7 — CLOSE (3:45–4:00)

[SCREEN] Back to the frontend result card. Zoom in on "Your identity is cryptographically unknowable."

[VOICE]
"The SEC has paid $1.9 billion in whistleblower awards since 2011. The average award is $5.4 million. The bottleneck is always the same: credibility without identity.

INCOGNITO is infrastructure for the next generation of financial enforcement. Built in one night at ETHGlobal New York 2026."

[SCREEN] Fade out on the tx hash.

---

## QUICK REFERENCE — THINGS TO HAVE VISIBLE

| What | Where |
|------|-------|
| Live form | http://localhost:3000 |
| Backend logs | Terminal 2 |
| CRE simulation | Terminal 4 |
| Inference proof | Chainlink AI playground — ID: 019ec2ae-ff69-766b-8eec-7a88540499b7 |
| Contract tx | https://sepolia.etherscan.io/tx/0x798dd81ba4e08982973287d145bcad5e426440c56e3ffae8d2fc29ce0a4cc61e |
| Contract address | https://sepolia.etherscan.io/address/0x2aa4206aa0b9d2434fa96c5330c17fc23709f597 |

---

## STARTUP COMMANDS (copy-paste order)

```bash
# Terminal 1 — HR server
cd path/to/INCOGNITO/backend && npm install && node mock-hr.js

# Terminal 2 — Backend
cd path/to/INCOGNITO/backend && node index.js

# Terminal 3 — Frontend
cd path/to/INCOGNITO/frontend && npx serve .

# Terminal 4 — CRE
cd path/to/cre-workflow/INCOGNITO && cre workflow simulate staging-settings
# Select: staging-settings
```
