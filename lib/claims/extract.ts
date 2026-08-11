import { complete, parseJson, systemMessage, userMessage } from "@/lib/llm";
import { scoreClaims } from "./risk";
import {
  CLAIM_CATEGORIES,
  EVIDENCE_KINDS,
  ScoredClaim,
  extractionResponseSchema,
} from "./schema";

/** Free-tier context windows are the binding constraint; resumes rarely exceed this. */
const MAX_RESUME_CHARS = 14_000;

const SYSTEM_PROMPT = `You are a hiring committee member at a top engineering company who reads resumes looking for claims that will not survive an interview.

You do NOT rewrite resumes. You do NOT give career advice. You identify assertions and describe, factually, what is missing from each one.

Rules:
- Extract only claims about what the candidate did or achieved. Skip contact details, education listings, section headers, and bare skill lists.
- Never invent detail that is not in the resume. If a number is absent, that absence is the finding.
- One resume bullet may contain several claims. Split them.
- "sourceLine" must be copied verbatim from the resume text.
- Judge signals from the resume text ALONE, not from what is plausible.

Signal definitions:
- quantified: the claim asserts a MEASURED result or scale — a percentage, a rate, a throughput, a latency, a cost. A plain count of people, teams or projects ("mentored three engineers", "migration of four teams") is NOT a measurement: set this false. Nobody asks for the baseline of "three engineers", and treating a headcount as a metric buries the claims that really do need one.
- hasBaseline: the text gives the before-state or absolute values, not just a delta.
- hasMeasurementMethod: the text says how it was measured (tool, metric, percentile).
- hasTimeframe: the text gives a period over which the result held.
- ownership: "individual" if the candidate is the stated actor ("I built", "Designed"), "shared" if credited to a team, "ambiguous" if it cannot be told apart.
- scopeMagnitude: small (one service or feature), medium (a system or team), large (multiple teams or a product), extreme (company-wide platform or org). Wording that claims the organisation's own infrastructure — "the company's data platform", "our core architecture" — is extreme.
- technicalSpecificity: high (names concrete systems, techniques, constraints), medium (some specifics), low (generic verbs only).

Categories: ${CLAIM_CATEGORIES.join(", ")}.
Evidence kinds: ${EVIDENCE_KINDS.join(", ")}.

Respond with JSON only, no prose, in exactly this shape:
{"claims":[{"claim":"...","sourceLine":"...","category":"impact","technologies":["..."],"signals":{"quantified":true,"hasBaseline":false,"hasMeasurementMethod":false,"hasTimeframe":false,"ownership":"ambiguous","scopeMagnitude":"medium","technicalSpecificity":"medium"},"evidenceRequired":["baseline"],"gaps":["No baseline latency given"]}]}`;

export interface ExtractClaimsResult {
  claims: ScoredClaim[];
  model: string;
}

export async function extractClaims(
  resumeText: string,
  targetRole?: string,
): Promise<ExtractClaimsResult> {
  const truncated = resumeText.slice(0, MAX_RESUME_CHARS);
  const roleLine = targetRole
    ? `\n\nThe candidate is targeting: ${targetRole}. Weigh scope and ownership against that bar.`
    : "";

  const messages = [
    systemMessage(SYSTEM_PROMPT),
    userMessage(`RESUME:\n\n${truncated}${roleLine}\n\nExtract every defensible-claim candidate as JSON.`),
  ];

  const first = await complete({ messages, json: true, maxTokens: 4000 });

  let parsed;
  try {
    parsed = parseJson(first.text, extractionResponseSchema);
  } catch (error) {
    // One repair attempt: weak models often miss a required field rather than
    // the overall shape, and showing them the validation error usually fixes it.
    const repair = await complete({
      messages: [
        ...messages,
        { role: "assistant", content: first.text.slice(0, 4000) },
        userMessage(
          `That response was rejected: ${error instanceof Error ? error.message : String(error)}\n` +
            `Return the corrected JSON only. Every claim needs all seven signal fields.`,
        ),
      ],
      json: true,
      maxTokens: 4000,
    });
    parsed = parseJson(repair.text, extractionResponseSchema);
  }

  const deduped = dedupe(parsed.claims);
  return { claims: scoreClaims(deduped), model: first.model };
}

/** Models occasionally emit the same bullet twice under different categories. */
function dedupe<T extends { claim: string }>(claims: T[]): T[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = claim.claim.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
