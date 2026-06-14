/**
 * DeadDrop — Agentic CRE Workflow
 * ETHGlobal NYC 2026
 *
 * 4 AI agents run sequentially inside the Chainlink DON TEE.
 * Each agent is a separate ConfidentialHTTPClient call to the Chainlink
 * Confidential AI Attester — cryptographically attested, tamper-proof.
 *
 * AGENT 1  Intake Triage      categorize claim, decide to proceed
 * AGENT 2  Specialist Analyst  deep analysis (branches by violation type)
 * AGENT 3  Legal Assessor     applicable laws, SEC award, protection level
 * AGENT 4  Verdict Synthesis  final attested verdict → on-chain write
 *
 * Whistleblower identity is stripped before every agent call.
 * Identity stored on-chain is always: UNKNOWABLE.
 */

import {
	type CronPayload,
	cre,
	getNetwork,
	json,
	prepareReportRequest,
	type Runtime,
	TxStatus,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, type Address } from 'viem'
import { z } from 'zod'

// ── Config schema ─────────────────────────────────────────────────────────────

export const configSchema = z.object({
	schedule: z.string(),
	claim: z.string(),
	evidenceSummary: z.string(),
	employeeId: z.string(),
	companyEmail: z.string(),
	tenureYears: z.number(),
	hrApiUrl: z.string(),
	hrApiKey: z.string(),
	aiApiUrl: z.string(),
	aiApiKey: z.string(),
	registryAddress: z.string(),
	chainSelectorName: z.string(),
	gasLimit: z.string(),
})

type Config = z.infer<typeof configSchema>

// ── Agent output types ────────────────────────────────────────────────────────

type ViolationCategory =
	| 'FINANCIAL_FRAUD'
	| 'SECURITIES_VIOLATION'
	| 'WORKPLACE_SAFETY'
	| 'CORRUPTION'
	| 'DATA_PRIVACY'
	| 'OTHER'

interface EmployeeVerification {
	verified: boolean
	role: string
	dept: string
}

interface IntakeTriage {
	category: ViolationCategory
	severity_hint: 1 | 2 | 3
	proceed: boolean
	triage_reason: string
}

interface SpecialistAnalysis {
	entities: {
		people: string[]
		organizations: string[]
		amounts: string[]
		dates: string[]
		documents: string[]
	}
	evidence_quality: number
	specific_violations: string[]
	key_risks: string[]
	investigation_steps: string[]
	analyst_notes: string
}

interface LegalAssessment {
	applicable_laws: string[]
	relevant_agencies: string[]
	protection_level: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'
	sec_award_eligible: boolean
	sec_award_reason: string
	dodd_frank_protected: boolean
	sox_protected: boolean
	legal_notes: string
}

interface FinalVerdict {
	credible: boolean
	severity: number
	route: string
	reason: string
	recommended_agencies: string[]
	pipeline_summary: string
	identity: string
}

// ── Confidential AI helper ────────────────────────────────────────────────────
// Each call is a separate round-trip to the Chainlink Confidential AI Attester.
// The TEE signs every response — the chain of 4 calls is fully attested.

function callConfidentialAI(
	runtime: Runtime<Config>,
	systemPrompt: string,
	userPrompt: string,
): string {
	const { config } = runtime
	const http = new cre.capabilities.ConfidentialHTTPClient()

	const resp = http.sendRequest(runtime, {
		request: {
			url: config.aiApiUrl,
			method: 'POST',
			bodyString: JSON.stringify({
				model: 'qwen3.6',
				system_prompt: systemPrompt,
				prompt: userPrompt,
			}),
			multiHeaders: {
				'Content-Type': { values: ['application/json'] },
				'Authorization': { values: [`Bearer ${config.aiApiKey}`] },
			},
		},
	}).result()

	const body = json(resp) as { output: string }
	return body.output.replace(/```json[\s\S]*?```|```/g, '').trim()
}

// ── Step 0: Employee verification (Confidential HTTP inside TEE) ──────────────

const verifyEmployee = (runtime: Runtime<Config>): EmployeeVerification => {
	const { config } = runtime
	const http = new cre.capabilities.ConfidentialHTTPClient()

	runtime.log(`[DeadDrop] Verifying employee ${config.employeeId} via ConfidentialHTTP...`)

	const resp = http.sendRequest(runtime, {
		request: {
			url: config.hrApiUrl,
			method: 'POST',
			bodyString: JSON.stringify({
				employee_id: config.employeeId,
				email: config.companyEmail,
			}),
			multiHeaders: {
				'Content-Type': { values: ['application/json'] },
				'x-api-key': { values: [config.hrApiKey] },
			},
		},
	}).result()

	const data = json(resp) as EmployeeVerification

	if (!data.verified) {
		throw new Error('[DeadDrop] Employee verification failed — claim rejected')
	}

	runtime.log(`[DeadDrop] ✓ Verified: ${data.role} / ${data.dept}`)
	return data
}

// ── AGENT 1: Intake Triage ────────────────────────────────────────────────────
// Categorizes the claim and decides whether to proceed.
// Fast, low-token call — gates the more expensive agents downstream.

const runIntakeAgent = (
	runtime: Runtime<Config>,
	verification: EmployeeVerification,
): IntakeTriage => {
	const { config } = runtime
	runtime.log('[DeadDrop] AGENT 1: Intake Triage Agent running...')

	const raw = callConfidentialAI(
		runtime,
		'You are an Intake Triage Agent for a whistleblower protection system. Your job is to quickly categorize claims and decide whether they warrant full investigation. Respond with valid JSON only — no markdown, no preamble.',
		`A ${verification.role} in ${verification.dept} with ${config.tenureYears} years tenure has submitted this claim:

CLAIM: ${config.claim}

Triage this claim. Output JSON only:
{
  "category": "FINANCIAL_FRAUD|SECURITIES_VIOLATION|WORKPLACE_SAFETY|CORRUPTION|DATA_PRIVACY|OTHER",
  "severity_hint": 1,
  "proceed": true,
  "triage_reason": "one sentence explaining your decision"
}

Severity: 1=minor, 2=serious, 3=critical public interest. Only set proceed=false if claim is clearly frivolous or impossible.`,
	)

	const triage = JSON.parse(raw) as IntakeTriage
	runtime.log(`[DeadDrop] Agent 1 ✓ category=${triage.category} severity_hint=${triage.severity_hint} proceed=${triage.proceed}`)

	if (!triage.proceed) {
		throw new Error(`[DeadDrop] Triage agent rejected claim: ${triage.triage_reason}`)
	}

	return triage
}

// ── AGENT 2: Specialist Deep Analyst (branches by violation type) ─────────────
// Each violation type gets a domain-specialized system prompt.
// This is the branching step — the pipeline adapts based on Agent 1's output.

const SPECIALIST_PROMPTS: Record<ViolationCategory, string> = {
	FINANCIAL_FRAUD:
		'You are a Financial Forensics Agent specialized in fraud detection, invoice manipulation, embezzlement, and false billing schemes. Analyze the claim for specific financial red flags.',
	SECURITIES_VIOLATION:
		'You are a Securities Compliance Agent specialized in SEC enforcement. Look for insider trading patterns, false disclosures to investors, and market manipulation.',
	WORKPLACE_SAFETY:
		'You are an OSHA Safety Assessment Agent. Identify unreported workplace hazards, falsified safety records, and violations of federal safety regulations.',
	CORRUPTION:
		'You are an Anti-Corruption Specialist. Identify bribery patterns, kickbacks, conflicts of interest, procurement fraud, and violations of the FCPA.',
	DATA_PRIVACY:
		'You are a Data Privacy Compliance Agent. Look for GDPR/CCPA violations, unauthorized data access or sharing, and breach concealment.',
	OTHER:
		'You are a General Compliance Analyst. Extract all relevant entities and assess the potential compliance and legal risk.',
}

const runSpecialistAgent = (
	runtime: Runtime<Config>,
	verification: EmployeeVerification,
	triage: IntakeTriage,
): SpecialistAnalysis => {
	const { config } = runtime
	runtime.log(`[DeadDrop] AGENT 2: ${triage.category} Specialist Agent running...`)

	const raw = callConfidentialAI(
		runtime,
		SPECIALIST_PROMPTS[triage.category],
		`Perform deep specialist analysis on this ${triage.category} claim.

Employee: ${verification.role}, ${verification.dept}, ${config.tenureYears} years tenure
Claim: ${config.claim}
Evidence Provided: ${config.evidenceSummary || 'None'}
Triage Result: ${JSON.stringify(triage)}

Extract entities, assess evidence quality, and identify specific violations. Output JSON only:
{
  "entities": {
    "people": ["names, roles, titles"],
    "organizations": ["companies, subsidiaries, shell entities"],
    "amounts": ["financial figures with context"],
    "dates": ["timeframes and dates"],
    "documents": ["records, systems, files referenced"]
  },
  "evidence_quality": 7,
  "specific_violations": ["describe each specific alleged violation"],
  "key_risks": ["describe risks if allegations are true"],
  "investigation_steps": ["3-5 concrete next investigation steps"],
  "analyst_notes": "one paragraph specialist assessment"
}`,
	)

	const analysis = JSON.parse(raw) as SpecialistAnalysis
	runtime.log(
		`[DeadDrop] Agent 2 ✓ evidence_quality=${analysis.evidence_quality}/10 violations=${analysis.specific_violations?.length ?? 0}`,
	)
	return analysis
}

// ── AGENT 3: Legal Assessment Agent ──────────────────────────────────────────
// Receives triage + specialist output and determines legal standing.
// Identifies applicable U.S. laws, protection level, and SEC award eligibility.

const runLegalAgent = (
	runtime: Runtime<Config>,
	triage: IntakeTriage,
	analysis: SpecialistAnalysis,
): LegalAssessment => {
	runtime.log('[DeadDrop] AGENT 3: Legal Assessment Agent running...')

	const raw = callConfidentialAI(
		runtime,
		'You are a Legal Assessment Agent specializing in U.S. whistleblower law: Dodd-Frank Act Section 21F, Sarbanes-Oxley Section 806, OSHA Section 11(c), False Claims Act, and FCPA. Assess protection level and agency jurisdiction. Respond with valid JSON only.',
		`Assess the legal standing of this ${triage.category} whistleblower claim.

AGENT 1 TRIAGE: ${JSON.stringify(triage)}
AGENT 2 SPECIALIST ANALYSIS:
  - Evidence quality: ${analysis.evidence_quality}/10
  - Specific violations: ${JSON.stringify(analysis.specific_violations)}
  - Key risks: ${JSON.stringify(analysis.key_risks)}

Determine applicable laws and protections. Output JSON only:
{
  "applicable_laws": ["list laws e.g. Dodd-Frank 21F, SOX 806, OSHA 11(c)"],
  "relevant_agencies": ["list agencies e.g. SEC, DOJ, OSHA, FBI"],
  "protection_level": "STRONG|MODERATE|WEAK|NONE",
  "sec_award_eligible": false,
  "sec_award_reason": "one sentence on SEC award eligibility (10-30% of sanctions over $1M)",
  "dodd_frank_protected": true,
  "sox_protected": false,
  "legal_notes": "one paragraph legal summary"
}`,
	)

	const legal = JSON.parse(raw) as LegalAssessment
	runtime.log(
		`[DeadDrop] Agent 3 ✓ protection=${legal.protection_level} SEC_eligible=${legal.sec_award_eligible}`,
	)
	return legal
}

// ── AGENT 4: Final Verdict Synthesis ─────────────────────────────────────────
// Receives all 3 prior agent outputs and produces the final attested verdict.
// This verdict is encoded and written on-chain — identity is always UNKNOWABLE.

const runVerdictAgent = (
	runtime: Runtime<Config>,
	triage: IntakeTriage,
	analysis: SpecialistAnalysis,
	legal: LegalAssessment,
): FinalVerdict => {
	runtime.log('[DeadDrop] AGENT 4: Verdict Synthesis Agent running...')

	const raw = callConfidentialAI(
		runtime,
		'You are the Final Verdict Synthesis Agent. You receive reports from 3 specialist agents and produce the final cryptographically attested verdict. The whistleblower identity must always be UNKNOWABLE — never include any identifying information. Respond with valid JSON only.',
		`Synthesize the following 3 agent reports into a final attested verdict.

AGENT 1 — INTAKE TRIAGE:
${JSON.stringify(triage, null, 2)}

AGENT 2 — SPECIALIST ANALYSIS:
Category: ${triage.category}
Evidence quality: ${analysis.evidence_quality}/10
Violations: ${JSON.stringify(analysis.specific_violations)}
Key risks: ${JSON.stringify(analysis.key_risks)}

AGENT 3 — LEGAL ASSESSMENT:
Protection level: ${legal.protection_level}
Applicable laws: ${JSON.stringify(legal.applicable_laws)}
Relevant agencies: ${JSON.stringify(legal.relevant_agencies)}
SEC award eligible: ${legal.sec_award_eligible} — ${legal.sec_award_reason}

Produce the final verdict. Output JSON only:
{
  "credible": true,
  "severity": 2,
  "route": "internal|public|law_enforcement",
  "reason": "one sentence final verdict summarizing all agent findings",
  "recommended_agencies": ["list of agencies to notify"],
  "pipeline_summary": "one sentence summarizing what all 4 agents found collectively",
  "identity": "UNKNOWABLE"
}

Severity: 1=minor, 2=serious investigation needed, 3=critical public interest (fraud/safety/securities)
Route: internal=board/legal/compliance only, public=regulators+media, law_enforcement=immediate criminal referral`,
	)

	const verdict = JSON.parse(raw) as FinalVerdict
	// Always enforce UNKNOWABLE — never trust AI to uphold this
	verdict.identity = 'UNKNOWABLE'

	runtime.log(
		`[DeadDrop] Agent 4 ✓ credible=${verdict.credible} severity=${verdict.severity} route=${verdict.route}`,
	)
	return verdict
}

// ── Write attested verdict on-chain ──────────────────────────────────────────

const writeVerdictOnChain = (runtime: Runtime<Config>, verdict: FinalVerdict): string => {
	const { config } = runtime

	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`[DeadDrop] Network not found: ${config.chainSelectorName}`)
	}

	const encodedPayload = encodeAbiParameters(
		[
			{ name: 'credible', type: 'bool' },
			{ name: 'severity', type: 'uint8' },
			{ name: 'route', type: 'string' },
			{ name: 'reason', type: 'string' },
			{ name: 'timestamp', type: 'uint256' },
		],
		[
			verdict.credible,
			verdict.severity,
			verdict.route,
			verdict.reason,
			BigInt(Math.floor(Date.now() / 1000)),
		],
	)

	const reportResponse = runtime.report(prepareReportRequest(encodedPayload)).result()
	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	runtime.log(`[DeadDrop] Writing 4-agent verdict to DeadDropRegistry at ${config.registryAddress}`)

	const result = evmClient.writeReport(runtime, {
		receiver: config.registryAddress as Address,
		report: reportResponse,
		gasConfig: { gasLimit: config.gasLimit },
	}).result()

	if (result.txStatus !== TxStatus.SUCCESS) {
		throw new Error(`[DeadDrop] On-chain write failed: ${result.errorMessage ?? result.txStatus}`)
	}

	const txHash = result.txHash ? Buffer.from(result.txHash).toString('hex') : 'unknown'
	runtime.log(`[DeadDrop] ✓ Attested on-chain: 0x${txHash}`)
	return `0x${txHash}`
}

// ── Cron trigger handler ──────────────────────────────────────────────────────

export const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
	if (!payload.scheduledExecutionTime) {
		throw new Error('[DeadDrop] Missing scheduledExecutionTime')
	}

	runtime.log('[DeadDrop] 4-agent agentic pipeline starting on Chainlink DON...')

	// Step 0: Verify employee identity inside TEE — PII never leaves enclave
	const verification = verifyEmployee(runtime)

	// Agent 1: Categorize claim, decide to proceed
	const triage = runIntakeAgent(runtime, verification)

	// Agent 2: Deep specialist analysis (pipeline branches by violation type)
	const analysis = runSpecialistAgent(runtime, verification, triage)

	// Agent 3: Legal assessment — laws, agencies, SEC award eligibility
	const legal = runLegalAgent(runtime, triage, analysis)

	// Agent 4: Synthesize all agent findings into final attested verdict
	const verdict = runVerdictAgent(runtime, triage, analysis, legal)

	// Write attested verdict on-chain — identity is UNKNOWABLE
	const txHash = writeVerdictOnChain(runtime, verdict)

	const output = {
		agents_run: 4,
		violation_type: triage.category,
		protection_level: legal.protection_level,
		sec_award_eligible: legal.sec_award_eligible,
		credible: verdict.credible,
		severity: verdict.severity,
		route: verdict.route,
		identity: 'UNKNOWABLE',
		pipeline_summary: verdict.pipeline_summary,
		txHash,
	}

	runtime.log(`[DeadDrop] Pipeline complete: ${JSON.stringify(output)}`)
	return JSON.stringify(output, null, 2)
}

// ── Workflow init ─────────────────────────────────────────────────────────────

export function initWorkflow(config: Config) {
	const cronTrigger = new cre.capabilities.CronCapability()

	return [
		cre.handler(
			cronTrigger.trigger({ schedule: config.schedule }),
			onCronTrigger,
		),
	]
}
