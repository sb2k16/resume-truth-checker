import { complete, parseJson, systemMessage, userMessage } from "@/lib/llm";
import {
  EVIDENCE_LABELS,
  ScoredClaim,
  batchQuestionsResponseSchema,
  questionsResponseSchema,
} from "@/lib/claims/schema";

export const PRESSURE_LEVELS = ["friendly", "realistic", "aggressive"] as const;
export type PressureLevel = (typeof PRESSURE_LEVELS)[number];

export const PRESSURE_LABELS: Record<PressureLevel, string> = {
  friendly: "Friendly",
  realistic: "Realistic",
  aggressive: "Aggressive",
};

export const PRESSURE_DESCRIPTIONS: Record<PressureLevel, string> = {
  friendly: "Helps you when an answer is thin.",
  realistic: "A normal interviewer.",
  aggressive: "A Staff-level interviewer who challenges assumptions.",
};

const PRESSURE_INSTRUCTIONS: Record<PressureLevel, string> = {
  friendly:
    "Ask openly and give the candidate room. Where an answer would be hard, hint at what a strong answer would contain.",
  realistic:
    "Ask the way a competent interviewer would: direct, specific, one question at a time.",
  aggressive:
    "Press hard. Challenge whether the claim is really theirs, whether the number is real, and whether the scope is honest. Do not be rude — be exacting.",
};

const SYSTEM_PROMPT = `You generate the questions an interviewer would actually ask about a specific resume claim.

Rules:
- Every question must come from the claim itself. Never ask generic interview questions ("tell me about yourself", "what's your greatest weakness").
- Target exactly what is missing: the baseline, the measurement, the candidate's own contribution, the alternatives, the failure modes.
- One question per string. No numbering, no preamble.
- Ask what an interviewer says out loud, not an analysis of the claim.

Respond with JSON only: {"questions":["...","..."]}`;

export async function generateQuestions(
  claim: ScoredClaim,
  options: {
    count?: number;
    pressure?: PressureLevel;
    targetRole?: string;
  } = {},
): Promise<string[]> {
  const count = options.count ?? 5;
  const pressure = options.pressure ?? "realistic";

  const missing = claim.evidenceRequired.map((kind) => EVIDENCE_LABELS[kind]).join(", ");
  const context = [
    `CLAIM: ${claim.claim}`,
    `RESUME LINE: ${claim.sourceLine}`,
    `CATEGORY: ${claim.category}`,
    `RISK: ${claim.riskLevel} (${claim.riskScore}/100)`,
    missing ? `UNSPECIFIED: ${missing}` : null,
    claim.riskReasons.length ? `GAPS: ${claim.riskReasons.join("; ")}` : null,
    options.targetRole ? `TARGET ROLE: ${options.targetRole}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await complete({
    messages: [
      systemMessage(`${SYSTEM_PROMPT}\n\nInterviewer style: ${PRESSURE_INSTRUCTIONS[pressure]}`),
      userMessage(`${context}\n\nGive exactly ${count} questions.`),
    ],
    json: true,
    temperature: 0.4,
    maxTokens: 800,
  });

  const parsed = parseJson(text, questionsResponseSchema);
  return parsed.questions.slice(0, count);
}

/**
 * Questions for several claims in one call. Done at analysis time so the report
 * lands with real questions already on it — and because five separate calls
 * would burn five free-tier requests to produce the same page.
 */
export async function generateQuestionsForClaims(
  claims: ScoredClaim[],
  options: { perClaim?: number; targetRole?: string } = {},
): Promise<Map<string, string[]>> {
  const perClaim = options.perClaim ?? 5;
  if (claims.length === 0) return new Map();

  const blocks = claims
    .map((claim) => {
      const missing = claim.evidenceRequired.map((kind) => EVIDENCE_LABELS[kind]).join(", ");
      return [
        `ID: ${claim.id}`,
        `CLAIM: ${claim.claim}`,
        `RESUME LINE: ${claim.sourceLine}`,
        `RISK: ${claim.riskLevel}`,
        missing ? `UNSPECIFIED: ${missing}` : null,
        claim.riskReasons.length ? `GAPS: ${claim.riskReasons.join("; ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");

  const { text } = await complete({
    messages: [
      systemMessage(
        `${SYSTEM_PROMPT.replace('{"questions":["...","..."]}', '{"questionsByClaim":{"<ID>":["...","..."]}}')}\n\n` +
          `Interviewer style: ${PRESSURE_INSTRUCTIONS.realistic}\n` +
          `Key every list by the claim's exact ID.`,
      ),
      userMessage(`${blocks}\n\nGive exactly ${perClaim} questions for each claim ID above.`),
    ],
    json: true,
    temperature: 0.4,
    maxTokens: 2000,
  });

  const parsed = parseJson(text, batchQuestionsResponseSchema);
  const result = new Map<string, string[]>();
  for (const claim of claims) {
    const questions = parsed.questionsByClaim[claim.id];
    if (questions?.length) result.set(claim.id, questions.slice(0, perClaim));
  }
  return result;
}

/**
 * The follow-up an interviewer asks after hearing an answer. Distinct from the
 * opening questions: it has to react to what was actually said, which is what
 * makes the drill-down in §16 feel real rather than scripted.
 */
export async function generateFollowUp(
  claim: ScoredClaim,
  exchange: { question: string; answer: string }[],
  pressure: PressureLevel,
): Promise<string> {
  const transcript = exchange
    .map((turn) => `Q: ${turn.question}\nA: ${turn.answer}`)
    .join("\n\n");

  const { text } = await complete({
    messages: [
      systemMessage(
        `You are interviewing a candidate about one resume claim. Ask the single next question a real interviewer would ask, based on what they just said. ` +
          `Probe the weakest part of their answer. If they admitted the claim overstates their role, ask directly whether they would keep that wording. ` +
          `Interviewer style: ${PRESSURE_INSTRUCTIONS[pressure]}\n\nRespond with the question text only — no preamble, no quotes.`,
      ),
      userMessage(`RESUME CLAIM: ${claim.claim}\n\nSO FAR:\n${transcript}\n\nNext question:`),
    ],
    temperature: 0.5,
    maxTokens: 200,
  });

  return text.trim().replace(/^["']|["']$/g, "");
}
